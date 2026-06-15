import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import type {
  AgentNode,
  LLMNode,
  ModelProvider,
  OpenAICompatibleSettings,
  WorkflowFile,
  WorkflowRuntimeState,
} from "@ai-agent-workflow/workflow-domain";
import { resolveLLMModelSettings } from "@ai-agent-workflow/workflow-domain";
import { RuntimeModelError, RuntimeValidationError } from "./errors";
import { logger } from "../logger";
import { resolvePrompt } from "./prompts";

function chooseModelSettings(workflow: WorkflowFile, node: LLMNode): OpenAICompatibleSettings {
  const settings = resolveLLMModelSettings(workflow, node);
  if (!settings) {
    throw new RuntimeValidationError("Workflow model provider settings are required for LLM runs.");
  }

  return settings;
}

/**
 * Resolves the bound model settings for an Agent node, reusing the LLM node's
 * resolution path (ADR 0005 — the agent config carries the same
 * `model`/`modelSettings`/`temperature`/`maxTokens` fields). `resolveLLMModelSettings`
 * only reads those shared config fields, so the agent node is a structural fit.
 */
export function resolveAgentModelSettings(workflow: WorkflowFile, node: AgentNode): OpenAICompatibleSettings {
  const settings = resolveLLMModelSettings(workflow, node as unknown as LLMNode);
  if (!settings) {
    throw new RuntimeValidationError("Agent node model provider settings are required. Configure a model provider.");
  }
  return settings;
}

/**
 * Builds the concrete, bind-capable LangChain `BaseChatModel` for a provider's
 * settings. This is the same instance the LLM path runs through (so `.invoke`
 * behavior is unchanged), but returned as the real model — not the `.invoke`-only
 * wrapper — so the Agent runtime can call `.bindTools()` for function calling
 * (ADR 0005). Token usage, streaming, and error handling stay identical to the
 * prior LLM path because the factory bodies are unchanged.
 */
export function createBoundCapableModel(settings: OpenAICompatibleSettings, fetchImpl: typeof fetch): BaseChatModel {
  const temperature = settings.temperature;
  const maxTokens = settings.maxTokens;
  const requireApiKey = (provider: ModelProvider) => {
    if (!settings.apiKey) {
      throw new RuntimeModelError(`API key is not configured for provider ${provider}.`);
    }
    return settings.apiKey;
  };
  const providerFactories: Record<ModelProvider, () => BaseChatModel> = {
    deepseek: () =>
      new ChatDeepSeek({
        model: settings.model,
        temperature,
        maxTokens,
        maxRetries: 0,
        timeout: 10_000,
        apiKey: requireApiKey("deepseek"),
        configuration: {
          baseURL: settings.baseURL,
          fetch: fetchImpl as any,
        },
      }),
    ollama: () =>
      new ChatOllama({
        think: false,
        model: settings.model,
        temperature,
        baseUrl: settings.baseURL,
        fetch: fetchImpl,
        checkOrPullModel: false,
      }),
    openai: () =>
      new ChatOpenAI({
        model: settings.model,
        temperature,
        maxTokens,
        apiKey: requireApiKey("openai"),
        configuration: {
          baseURL: settings.baseURL,
          fetch: fetchImpl as any,
        },
      }),
    anthropic: () =>
      new ChatAnthropic({
        model: settings.model,
        temperature,
        maxTokens,
        apiKey: requireApiKey("anthropic"),
        anthropicApiUrl: settings.baseURL,
        clientOptions: {
          fetch: fetchImpl as any,
        },
      }),
  };

  return providerFactories[settings.provider]();
}

export function stringifyMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (typeof part === "object" && part && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("");
}

/**
 * Turns a raw provider/LangChain error into a concise, user-facing message.
 * Strips LangChain's "Troubleshooting URL" footer and, when the body embeds a
 * provider error JSON (e.g. Anthropic/OpenAI), surfaces its `error.message`
 * prefixed with the HTTP status so the UI shows "404: Not found" instead of an
 * opaque "Node execution failed."
 */
export function humanizeModelError(raw: string): string {
  const cleaned = raw.split(/\n\s*Troubleshooting URL:/i)[0].trim();
  const status = cleaned.match(/^\s*(\d{3})\b/)?.[1];
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { message?: string; error?: { message?: string } };
      const inner = parsed.error?.message ?? parsed.message;
      if (typeof inner === "string" && inner.trim()) {
        return status ? `${status}: ${inner.trim()}` : inner.trim();
      }
    } catch {
      // Not JSON — fall through to the cleaned raw text.
    }
  }
  return cleaned.replace(/\s+/g, " ").trim() || "Model request failed.";
}

function extractReasoning(response: Record<string, any>): unknown {
  return (
    response.additional_kwargs?.reasoning_content ??
    response.additional_kwargs?.reasoning ??
    response.response_metadata?.reasoning_content ??
    response.response_metadata?.reasoning ??
    null
  );
}

export async function callChatCompletion(
  workflow: WorkflowFile,
  node: LLMNode,
  state: WorkflowRuntimeState,
  fetchImpl: typeof fetch,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  /** Running summary of compressed older turns (Chat Mode summary-buffer memory). */
  summary = "",
) {
  const settings = chooseModelSettings(workflow, node);
  // Guard against an unmigrated/legacy config reaching the runtime (e.g. a stored
  // workflow that bypassed schema normalization): surface a clear error instead of
  // a cryptic `reading 'map'`. Normal runs always have a parsed `messages[]`.
  if (!Array.isArray(node.config.messages)) {
    throw new RuntimeValidationError(
      `LLM node "${node.id}" has no prompt messages configured. Re-open and save the workflow to migrate it.`,
    );
  }
  // Resolve every configured prompt message, dropping ones that are blank after
  // variable substitution (matches the prior "skip empty system prompt" behavior).
  const resolved = node.config.messages
    .map((message) => ({ role: message.role, content: resolvePrompt(message.content, state) }))
    .filter((message) => message.content.trim().length > 0);
  const toLangChainMessage = (message: { role: "system" | "user" | "assistant"; content: string }) =>
    message.role === "system"
      ? new SystemMessage(message.content)
      : message.role === "assistant"
        ? new AIMessage(message.content)
        : new HumanMessage(message.content);

  const model = createBoundCapableModel(settings, fetchImpl);
  const historyMessages = history.map((message) =>
    message.role === "assistant" ? new AIMessage(message.content) : new HumanMessage(message.content),
  );
  // Memory history belongs after any leading system prompts but before this
  // turn's user/assistant messages, so prior turns frame the new request. The
  // running summary (compressed older turns) sits just ahead of the verbatim
  // history as additional system context.
  const firstNonSystem = resolved.findIndex((message) => message.role !== "system");
  const splitAt = firstNonSystem === -1 ? resolved.length : firstNonSystem;
  const summaryMessages = summary.trim()
    ? [new SystemMessage(`以下是早先对话的摘要，供你参考：\n${summary.trim()}`)]
    : [];
  const messages = [
    ...resolved.slice(0, splitAt).map(toLangChainMessage),
    ...summaryMessages,
    ...historyMessages,
    ...resolved.slice(splitAt).map(toLangChainMessage),
  ];
  // The user-facing prompt for this turn (last user message), kept for memory append.
  const userPrompt = [...resolved].reverse().find((message) => message.role === "user")?.content ?? "";
  const hasSystemPrompt = resolved.some((message) => message.role === "system");

  let response: Record<string, any>;
  try {
    logger.info("runtime.model.invoke_started", {
      nodeId: node.id,
      provider: settings.provider,
      model: settings.model,
      hasSystemPrompt,
      userPromptLength: userPrompt.length,
    });
    response = (await model.invoke(messages)) as Record<string, any>;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Model invocation failed.";
    logger.error("runtime.model.invoke_failed", {
      nodeId: node.id,
      provider: settings.provider,
      model: settings.model,
      message: rawMessage,
    });
    // Surface a concise, provider-aware message that names the model so the UI
    // can explain failures like a deprecated/unknown model (404 Not found).
    throw new RuntimeModelError(`${settings.provider} model "${settings.model}" — ${humanizeModelError(rawMessage)}`);
  }

  const text = stringifyMessageContent(response.content);
  logger.info("runtime.model.invoke_completed", {
    nodeId: node.id,
    provider: settings.provider,
    model: settings.model,
    outputLength: text.length,
    hasUsage: Boolean(response.usage_metadata ?? response.response_metadata?.tokenUsage),
  });

  return {
    text,
    userPrompt,
    usage: response.usage_metadata ?? response.response_metadata?.tokenUsage ?? null,
    reasoning: extractReasoning(response),
  };
}

/**
 * Folds a prior running summary plus a batch of overflow turns into one concise
 * summary, used by the Chat Mode summary-buffer memory when the buffer exceeds its
 * token budget. Reuses the node's own model settings (no separate summarizer
 * config). Returns the merged summary text.
 */
export async function summarizeMessages(
  workflow: WorkflowFile,
  node: LLMNode,
  priorSummary: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  fetchImpl: typeof fetch,
): Promise<string> {
  const settings = chooseModelSettings(workflow, node);
  const model = createBoundCapableModel(settings, fetchImpl);
  const transcript = messages
    .map((message) => `${message.role === "assistant" ? "助手" : "用户"}：${message.content}`)
    .join("\n");
  const system = new SystemMessage(
    "你是一个对话摘要器。把已有摘要与新的对话片段合并成一段简洁、信息完整的摘要，" +
      "保留关键事实、用户偏好、已达成的结论与未决事项。只输出摘要正文，不要解释。",
  );
  const human = new HumanMessage(
    `已有摘要：\n${priorSummary.trim() || "（无）"}\n\n新的对话片段：\n${transcript}\n\n请输出合并后的摘要：`,
  );
  try {
    const response = (await model.invoke([system, human])) as Record<string, any>;
    return stringifyMessageContent(response.content).trim();
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Summary failed.";
    logger.error("runtime.memory.summarize_failed", {
      nodeId: node.id,
      provider: settings.provider,
      model: settings.model,
      message: rawMessage,
    });
    throw new RuntimeModelError(`${settings.provider} model "${settings.model}" — ${humanizeModelError(rawMessage)}`);
  }
}
