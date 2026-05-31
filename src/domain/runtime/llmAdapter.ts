import { mergeVariableValues, resolvePromptVariables } from "../workflow/promptVariables";
import type { LLMNode } from "../workflow/schema";
import type { LLMRuntimeAdapter, RuntimeAdapterContext, RuntimeResult } from "./types";

type ChatCompletionResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: Record<string, unknown>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export const llmNodeAdapter: LLMRuntimeAdapter = {
  id: "openai-compatible-chat",
  label: "OpenAI-compatible Chat Completions",
  executable: true,
  execute: executeLLMNode,
};

export async function executeLLMNode(
  node: LLMNode,
  context: RuntimeAdapterContext,
): Promise<RuntimeResult> {
  const started = performance.now();
  const startedAt = new Date().toISOString();
  const variables = mergeVariableValues(node.config.variables, context.testVariables);
  const systemResolution = node.config.systemPrompt
    ? resolvePromptVariables(node.config.systemPrompt, variables)
    : ({ ok: true, text: undefined, variables: [] } as const);
  const userResolution = resolvePromptVariables(node.config.userPrompt, variables);

  if (!systemResolution.ok || !userResolution.ok) {
    const missing = [
      ...new Set([
        ...(!systemResolution.ok ? systemResolution.missingVariables : []),
        ...(!userResolution.ok ? userResolution.missingVariables : []),
      ]),
    ].sort();
    return finishResult(started, startedAt, {
      nodeId: node.id,
      nodeType: "llm",
      adapter: llmNodeAdapter.id,
      status: "error",
      resolvedPrompt: { system: undefined, user: undefined, variables },
      error: {
        code: "missing_variables",
        message: `Missing prompt variables: ${missing.join(", ")}`,
      },
    });
  }

  const settings = context.modelProvider;
  if (!settings?.baseURL || !settings.model) {
    return finishResult(started, startedAt, {
      nodeId: node.id,
      nodeType: "llm",
      adapter: llmNodeAdapter.id,
      status: "error",
      resolvedPrompt: { system: systemResolution.text, user: userResolution.text, variables },
      error: {
        code: "missing_model_settings",
        message: "Model base URL and model are required before running an LLM node.",
      },
    });
  }

  const model = node.config.model || settings.model;
  const messages = [
    ...(systemResolution.text ? [{ role: "system" as const, content: systemResolution.text }] : []),
    { role: "user" as const, content: userResolution.text },
  ];
  const url = `${settings.baseURL.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model,
    messages,
    temperature: node.config.temperature ?? 0.7,
    max_tokens: node.config.maxTokens ?? 800,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: context.signal,
    });
    const rawText = await response.text();
    const parsed = parseJson(rawText);

    if (!response.ok) {
      const errorBody = parsed as ChatCompletionResponse | undefined;
      return finishResult(started, startedAt, {
        nodeId: node.id,
        nodeType: "llm",
        adapter: llmNodeAdapter.id,
        status: "error",
        resolvedPrompt: { system: systemResolution.text, user: userResolution.text, variables },
        request: { url, method: "POST", model, messages, body },
        rawResponseSummary: summarizeRawResponse(parsed ?? rawText),
        error: {
          code: errorBody?.error?.code || `http_${response.status}`,
          message: errorBody?.error?.message || `Model endpoint returned HTTP ${response.status}.`,
          detail: rawText.slice(0, 1000),
        },
      });
    }

    const completion = parsed as ChatCompletionResponse | undefined;
    const responseText = completion?.choices?.[0]?.message?.content;
    return finishResult(started, startedAt, {
      nodeId: node.id,
      nodeType: "llm",
      adapter: llmNodeAdapter.id,
      status: "success",
      resolvedPrompt: { system: systemResolution.text, user: userResolution.text, variables },
      request: { url, method: "POST", model, messages, body },
      responseText: responseText || "",
      rawResponseSummary: summarizeRawResponse(completion ?? rawText),
    });
  } catch (error) {
    const name = (error as Error).name;
    return finishResult(started, startedAt, {
      nodeId: node.id,
      nodeType: "llm",
      adapter: llmNodeAdapter.id,
      status: "error",
      resolvedPrompt: { system: systemResolution.text, user: userResolution.text, variables },
      request: { url, method: "POST", model, messages, body },
      error: {
        code: name === "AbortError" ? "aborted" : "request_failed",
        message: name === "AbortError" ? "Run was cancelled." : (error as Error).message,
      },
    });
  }
}

function finishResult(
  started: number,
  startedAt: string,
  result: Omit<RuntimeResult, "startedAt" | "completedAt" | "latencyMs">,
): RuntimeResult {
  const completedAt = new Date().toISOString();
  return {
    ...result,
    startedAt,
    completedAt,
    latencyMs: Math.max(0, Math.round(performance.now() - started)),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function summarizeRawResponse(value: unknown): string {
  if (typeof value === "string") {
    return value.slice(0, 1200);
  }
  return JSON.stringify(value, null, 2).slice(0, 1200);
}
