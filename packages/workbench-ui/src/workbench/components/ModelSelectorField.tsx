import { Check, ChevronDown, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { OpenAICompatibleSettings } from "@ai-agent-workflow/workflow-domain";
import { Button } from "./Button";
import { ModelCapabilityTags } from "./ModelCapabilityTags";
import type { ProviderOption } from "./modelCatalog";
import { ModelProviderLogo } from "./modelProviderVisuals";
import { Popover } from "./Popover";

type ModelSelectorFieldProps = {
  providers: ProviderOption[];
  selectedProvider: ProviderOption;
  selectorId?: string;
  value: OpenAICompatibleSettings;
  onModelNameChange: (model: string) => void;
  onSelectModel: (provider: ProviderOption, model: string) => void;
};

export function ModelSelectorField({
  providers,
  selectedProvider,
  selectorId = "workbench-model-selector",
  value,
  onModelNameChange,
  onSelectModel,
}: ModelSelectorFieldProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProviders = providers
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((model) => model.id.toLowerCase().includes(normalizedQuery)),
    }))
    .filter((provider) => normalizedQuery === "" || provider.models.length > 0);

  const selectModel = (provider: ProviderOption, model: string) => {
    onSelectModel(provider, model);
    setSelectorOpen(false);
    setQuery("");
  };

  return (
    <>
      <Field label="Model">
        <Popover
          id={selectorId}
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
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
                <ModelProviderLogo provider={selectedProvider.provider} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{value.model}</span>
                <span className="block truncate text-[11px] text-slate-500">{selectedProvider.label}</span>
              </span>
              <ModelCapabilityTags capabilities={selectedProvider.models.find((model) => model.id === value.model)?.capabilities ?? ["chat"]} />
              <ChevronDown size={16} className="text-slate-400" aria-hidden />
            </Button>
          )}
        >
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-xl shadow-slate-900/10">
            <div className="border-b border-slate-200 p-3">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-600 focus-within:border-emerald-400 focus-within:bg-white">
                <Search size={16} className="text-slate-400" aria-hidden />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="Search model"
                />
              </label>
            </div>
            <div className="max-h-72 overflow-y-auto py-2">
              {filteredProviders.map((provider) => (
                <ModelGroup key={provider.provider} provider={provider} selectedModel={value.model} onSelect={selectModel} />
              ))}
              {filteredProviders.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">No models found.</p>}
            </div>
          </div>
        </Popover>
      </Field>

      <Field label="Model name">
        <div className="flex items-center rounded-md border border-slate-200 px-2">
          <input
            value={value.model}
            onChange={(event) => onModelNameChange(event.target.value)}
            className="h-9 min-w-0 flex-1 text-sm outline-none"
            placeholder={selectedProvider.defaultModel}
          />
          <ModelCapabilityTags capabilities={selectedProvider.models.find((model) => model.id === value.model)?.capabilities ?? ["chat"]} />
        </div>
      </Field>
    </>
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
  return (
    <div className="pb-2">
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-500">
        <span>{provider.label}</span>
        <ChevronDown size={13} aria-hidden />
      </div>
      <div className="space-y-1 px-2">
        {provider.models.map((model) => {
          const selected = model.id === selectedModel;
          return (
            <Button
              key={model.id}
              variant="modelOption"
              size="unstyled"
              onClick={() => onSelect(provider, model.id)}
              className="px-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
                <ModelProviderLogo provider={provider.provider} />
              </span>
              <span className="min-w-0 flex-1 truncate">{model.id}</span>
              <ModelCapabilityTags capabilities={model.capabilities} />
              {selected && <Check size={16} className="text-emerald-600" aria-hidden />}
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
