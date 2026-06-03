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

function createChatModel(settings: OpenAICompatibleSettings, node: LLMNode, fetchImpl: typeof fetch): RuntimeChatModel {
  const temperature = node.config.modelSettings?.temperature ?? node.config.temperature;
  const maxTokens = node.config.modelSettings?.maxTokens ?? node.config.maxTokens;
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
        userPrompt
    });
    response = (await model.invoke(messages)) as Record<string, any>;
  } catch (error) {
    logger.error("runtime.model.invoke_failed", {
      nodeId: node.id,
      provider: settings.provider,
      model: settings.model,
      message: error instanceof Error ? error.message : "Model invocation failed.",
    });
    throw new RuntimeModelError(error instanceof Error ? error.message : "Model invocation failed.");
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
