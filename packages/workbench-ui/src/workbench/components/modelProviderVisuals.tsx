import type { ModelProvider } from "@ai-agent-workflow/workflow-domain";
import anthropicIconUrl from "../assets/anthropic.ico";
import deepseekIconUrl from "../assets/deepseek.ico";
import ollamaIconUrl from "../assets/ollama.png";
import openaiIconUrl from "../assets/openai.svg";

type ModelProviderIcon = {
  label: string;
  src: string;
};

const modelProviderIcons: Record<ModelProvider, ModelProviderIcon> = {
  deepseek: {
    label: "DeepSeek",
    src: deepseekIconUrl,
  },
  openai: {
    label: "OpenAI",
    src: openaiIconUrl,
  },
  anthropic: {
    label: "Anthropic",
    src: anthropicIconUrl,
  },
  ollama: {
    label: "Ollama",
    src: ollamaIconUrl,
  },
};

export function getModelProviderIcon(provider?: ModelProvider) {
  return modelProviderIcons[provider || "deepseek"];
}

export function ModelProviderLogo({ provider }: { provider?: ModelProvider }) {
  const icon = getModelProviderIcon(provider);

  return (
    <img
      src={icon.src}
      alt={icon.label}
      className="max-h-5 max-w-5 object-contain"
      draggable={false}
    />
  );
}
