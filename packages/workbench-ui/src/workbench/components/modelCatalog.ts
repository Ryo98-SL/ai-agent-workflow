import type { ModelProvider } from "@ai-agent-workflow/workflow-domain";

export type ModelCapability = "chat" | "image";

export type ModelOption = {
  id: string;
  capabilities: ModelCapability[];
};

export type ProviderOption = {
  provider: ModelProvider;
  label: string;
  defaultBaseURL: string;
  defaultModel: string;
  models: ModelOption[];
  devOnly?: boolean;
};

const chatOnly = ["chat"] satisfies ModelCapability[];
const multimodal = ["chat", "image"] satisfies ModelCapability[];

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    provider: "deepseek",
    label: "deepseek",
    defaultBaseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    models: [
      { id: "deepseek-v4-flash", capabilities: chatOnly },
      { id: "deepseek-v4-pro", capabilities: chatOnly },
      { id: "deepseek-chat", capabilities: chatOnly },
      { id: "deepseek-coder", capabilities: chatOnly },
      { id: "deepseek-reasoner", capabilities: chatOnly },
    ],
  },
  {
    provider: "openai",
    label: "OpenAI",
    defaultBaseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-5.2",
    models: [
      { id: "gpt-5.2", capabilities: multimodal },
      { id: "gpt-5.1", capabilities: multimodal },
      { id: "gpt-5", capabilities: multimodal },
      { id: "gpt-5-mini", capabilities: multimodal },
      { id: "gpt-5-nano", capabilities: multimodal },
      { id: "gpt-4.1", capabilities: multimodal },
      { id: "gpt-4.1-mini", capabilities: multimodal },
      { id: "gpt-4.1-nano", capabilities: multimodal },
    ],
  },
  {
    provider: "anthropic",
    label: "Anthropic",
    defaultBaseURL: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      { id: "claude-opus-4-1-20250805", capabilities: multimodal },
      { id: "claude-opus-4-20250514", capabilities: multimodal },
      { id: "claude-sonnet-4-20250514", capabilities: multimodal },
      { id: "claude-3-7-sonnet-20250219", capabilities: multimodal },
      { id: "claude-3-5-haiku-20241022", capabilities: multimodal },
    ],
  },
  {
    provider: "ollama",
    label: "Ollama",
    defaultBaseURL: "http://127.0.0.1:11434",
    defaultModel: "qwen3.5:0.8b",
    models: [
      { id: "llama3.2", capabilities: multimodal },
      { id: "llama3.1", capabilities: chatOnly },
      { id: "qwen3.5:0.8b", capabilities: chatOnly },
      { id: "mistral", capabilities: chatOnly },
      { id: "codellama", capabilities: chatOnly },
    ],
    devOnly: true,
  },
];

export function getProviderOption(provider: ModelProvider) {
  return PROVIDER_OPTIONS.find((option) => option.provider === provider);
}

/**
 * A model is "custom" when it is not part of the curated catalog for its
 * provider — i.e. the user typed their own model id against a preset provider.
 * Derived rather than stored, so settings stay a plain `model` string.
 */
export function isCustomModel(model: string | undefined, provider?: ModelProvider): boolean {
  if (!model) {
    return false;
  }

  const option = provider ? getProviderOption(provider) : undefined;
  if (!option) {
    return false;
  }

  return !option.models.some((candidate) => candidate.id === model);
}

export function getModelCapabilities(model?: string, provider?: ModelProvider): ModelCapability[] {
  if (!model) {
    return chatOnly;
  }

  const providers = provider ? PROVIDER_OPTIONS.filter((option) => option.provider === provider) : PROVIDER_OPTIONS;
  const modelOption = providers.flatMap((option) => option.models).find((option) => option.id === model);

  return modelOption?.capabilities ?? chatOnly;
}
