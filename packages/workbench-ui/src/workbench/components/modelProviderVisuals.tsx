import type { ModelProvider } from "@ai-agent-workflow/workflow-domain";
import anthropicIconUrl from "../assets/anthropic.ico";
import deepseekIconUrl from "../assets/deepseek.ico";
import ollamaIconUrl from "../assets/ollama.png";
import openaiIconUrl from "../assets/openai.svg";
import {cn} from "@workbench/lib/utils";

type ModelProviderIcon = {
  label: string;
  src: string;
  className?: string;
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
    className: 'bg-white'
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
      className={cn("max-h-5 max-w-5 object-contain", icon.className)}
      draggable={false}
    />
  );
}
