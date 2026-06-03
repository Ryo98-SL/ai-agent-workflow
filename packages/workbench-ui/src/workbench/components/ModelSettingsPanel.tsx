import { Check, ChevronDown, KeyRound, Search, Server, Sparkles, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { ModelProvider, OpenAICompatibleSettings } from "@ai-agent-workflow/workflow-domain";
import { Button } from "./Button";
import { Popover } from "./Popover";

type ModelSettingsPanelProps = {
  settings?: OpenAICompatibleSettings;
  showDevModelProviders?: boolean;
  onChange: (settings: OpenAICompatibleSettings) => void;
};

type ProviderOption = {
  provider: ModelProvider;
  label: string;
  defaultBaseURL: string;
  defaultModel: string;
  models: string[];
  icon: LucideIcon;
  accentClassName: string;
  devOnly?: boolean;
};

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    provider: "deepseek",
    label: "deepseek",
    defaultBaseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-flash",
    models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    icon: Sparkles,
    accentClassName: "bg-blue-600 text-white",
  },
  {
    provider: "ollama",
    label: "Ollama",
    defaultBaseURL: "http://127.0.0.1:11434",
    defaultModel: "qwen3.5:0.8b",
    models: ["llama3.2", "llama3.1", "qwen3.5:0.8b", "mistral", "codellama"],
    icon: Server,
    accentClassName: "bg-emerald-600 text-white",
    devOnly: true,
  },
];

export const DEFAULT_MODEL_SETTINGS: OpenAICompatibleSettings = {
  provider: "ollama",
  baseURL: "http://127.0.0.1:11434",
  model: "qwen3.5:0.8b",
  apiKey: "",
};

export function ModelSettingsPanel({ settings, showDevModelProviders = false, onChange }: ModelSettingsPanelProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const availableProviders = useMemo(
    () => PROVIDER_OPTIONS.filter((option) => showDevModelProviders || !option.devOnly),
    [showDevModelProviders],
  );
  const rawValue = settings || DEFAULT_MODEL_SETTINGS;
  const value = availableProviders.some((option) => option.provider === rawValue.provider) ? rawValue : DEFAULT_MODEL_SETTINGS;
  const selectedProvider = getProviderOption(value.provider) || PROVIDER_OPTIONS[0];
  const SelectedIcon = selectedProvider.icon;
  const filteredProviders = availableProviders
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((model) => model.toLowerCase().includes(query.trim().toLowerCase())),
    }))
    .filter((provider) => query.trim() === "" || provider.models.length > 0);

  const update = (patch: Partial<OpenAICompatibleSettings>) => {
    onChange({ ...value, ...patch });
  };

  const selectModel = (provider: ProviderOption, model: string) => {
    onChange({
      provider: provider.provider,
      baseURL: value.provider === provider.provider ? value.baseURL : provider.defaultBaseURL,
      model,
      apiKey: provider.provider === "deepseek" ? value.apiKey : undefined,
    });
    setSelectorOpen(false);
    setQuery("");
  };

  return (
    <section className="p-4">
      <div className="space-y-3">
        <Field label="Model">
          <Popover
            id="workbench-model-selector"
            open={selectorOpen}
            onOpenChange={setSelectorOpen}
            placement="bottom-start"
            matchReferenceWidth
            preserveNestedPopoverPress={false}
            renderTrigger={({ ref, props }) => (
              <Button
                {...props}
                ref={ref}
                variant="modelTrigger"
                size="unstyled"
                onClick={() => setSelectorOpen((current) => !current)}
                aria-label="Choose model provider and model"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${selectedProvider.accentClassName}`}>
                  <SelectedIcon size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{value.model}</span>
                  <span className="block truncate text-[11px] text-slate-400">{selectedProvider.label}</span>
                </span>
                <span className="rounded-md border border-slate-600 px-1.5 py-0.5 text-[10px] font-semibold tracking-normal text-slate-300">
                  CHAT
                </span>
                <ChevronDown size={16} className="text-slate-400" aria-hidden />
              </Button>
            )}
          >
            <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-white shadow-xl shadow-slate-900/30">
              <div className="border-b border-slate-800 p-3">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-600 px-3 text-slate-300 focus-within:border-blue-400">
                  <Search size={16} className="text-slate-500" aria-hidden />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                    placeholder="Search model"
                  />
                </label>
              </div>
              <div className="max-h-72 overflow-y-auto py-2">
                {filteredProviders.map((provider) => (
                  <ModelGroup key={provider.provider} provider={provider} selectedModel={value.model} onSelect={selectModel} />
                ))}
                {filteredProviders.length === 0 && <p className="px-4 py-6 text-sm text-slate-400">No models found.</p>}
              </div>
            </div>
          </Popover>
        </Field>

        <Field label="Model name">
          <input
            value={value.model}
            onChange={(event) => update({ model: event.target.value })}
            className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
            placeholder={selectedProvider.defaultModel}
          />
        </Field>

        <Field label="Base URL">
          <input
            value={value.baseURL}
            onChange={(event) => update({ baseURL: event.target.value })}
            className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
            placeholder={selectedProvider.defaultBaseURL}
          />
        </Field>

        {value.provider === "deepseek" && (
          <Field label="API Key">
            <div className="flex items-center gap-2 rounded-md border border-slate-200 px-2">
              <KeyRound size={14} className="text-slate-400" aria-hidden />
              <input
                value={value.apiKey || ""}
                onChange={(event) => update({ apiKey: event.target.value })}
                className="h-9 min-w-0 flex-1 text-sm outline-none"
                placeholder="Stored in memory only"
                type="password"
              />
            </div>
          </Field>
        )}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        API keys are used for runs but omitted from saved workflow files.
      </p>
    </section>
  );
}

function ModelGroup({
  provider,
  selectedModel,
  onSelect,
}: {
  provider: ProviderOption;
  selectedModel: string;
  onSelect: (provider: ProviderOption, model: string) => void;
}) {
  const Icon = provider.icon;

  return (
    <div className="pb-2">
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-400">
        <span>{provider.label}</span>
        <ChevronDown size={13} aria-hidden />
      </div>
      <div className="space-y-1 px-2">
        {provider.models.map((model) => {
          const selected = model === selectedModel;
          return (
            <Button
              key={model}
              variant="modelOption"
              size="unstyled"
              onClick={() => onSelect(provider, model)}
              className="px-2"
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${provider.accentClassName}`}>
                <Icon size={14} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">{model}</span>
              {selected && <Check size={16} className="text-blue-400" aria-hidden />}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function getProviderOption(provider: ModelProvider) {
  return PROVIDER_OPTIONS.find((option) => option.provider === provider);
}
