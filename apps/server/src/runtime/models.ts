import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import type {
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

type RuntimeChatModel = {
  invoke: (messages: Array<SystemMessage | HumanMessage>) => Promise<Record<string, any>>;
};

function createChatModel(settings: OpenAICompatibleSettings, _node: LLMNode, fetchImpl: typeof fetch): RuntimeChatModel {
  const temperature = settings.temperature;
  const maxTokens = settings.maxTokens;
  const providerFactories: Record<ModelProvider, () => RuntimeChatModel> = {
    deepseek: () =>
      new ChatDeepSeek({
        model: settings.model,
        temperature,
        maxTokens,
        maxRetries: 0,
        timeout: 10_000,
        apiKey: settings.apiKey || "missing-deepseek-api-key",
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
        apiKey: settings.apiKey || "missing-openai-api-key",
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
        apiKey: settings.apiKey || "missing-anthropic-api-key",
        anthropicApiUrl: settings.baseURL,
        clientOptions: {
          fetch: fetchImpl as any,
        },
      }),
  };

  return providerFactories[settings.provider]();
}

function stringifyMessageContent(content: unknown): string {
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
) {
  const settings = chooseModelSettings(workflow, node);
  const systemPrompt = node.config.systemPrompt ? resolvePrompt(node.config.systemPrompt, state) : "";
  const userPrompt = resolvePrompt(node.config.userPrompt, state);
  const model = createChatModel(settings, node, fetchImpl);
  const messages = [...(systemPrompt ? [new SystemMessage(systemPrompt)] : []), new HumanMessage(userPrompt)];

  let response: Record<string, any>;
  try {
    logger.info("runtime.model.invoke_started", {
      nodeId: node.id,
      provider: settings.provider,
      model: settings.model,
      hasSystemPrompt: Boolean(systemPrompt),
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
    usage: response.usage_metadata ?? response.response_metadata?.tokenUsage ?? null,
    reasoning: extractReasoning(response),
  };
}
