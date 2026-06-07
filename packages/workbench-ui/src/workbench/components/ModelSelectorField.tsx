import { ArrowLeft, Check, ChevronDown, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import type {
  ModelProvider,
  OpenAICompatibleSettings,
  ProviderKeyPreference,
  ProviderKeyPrefs,
} from "@ai-agent-workflow/workflow-domain";
import { Badge } from "@workbench/components/ui/badge";
import { Input } from "@workbench/components/ui/input";
import { Button } from "./Button";
import { FIELD_INPUT_CLASS, FIELD_SHELL_CLASS, FIELD_SHELL_INPUT_CLASS } from "./fieldStyles";
import { ModelCapabilityTags } from "./ModelCapabilityTags";
import { getModelCapabilities, getProviderOption, isCustomModel, type ProviderOption } from "./modelCatalog";
import { ModelProviderLogo } from "./modelProviderVisuals";
import { Popover } from "./Popover";
import { ProviderApiKeyControl } from "./ProviderApiKeyControl";
import { ProviderPicker } from "./ProviderPicker";

type SelectorCustomModel = {
  id: string;
  provider: ModelProvider;
  model: string;
  baseURL?: string;
};

type ModelSelectorFieldProps = {
  providers: ProviderOption[];
  selectedProvider: ProviderOption;
  selectorId?: string;
  value: OpenAICompatibleSettings;
  onSelectModel: (provider: ProviderOption, model: string) => void;
  customModels?: SelectorCustomModel[];
  /** When provided, adding a custom model persists it (authenticated users). */
  onAddCustomModel?: (provider: ModelProvider, model: string, baseURL?: string) => void;
  onRemoveCustomModel?: (id: string) => void;
  /** Per-provider API key selection persisted in workflow settings. */
  providerKeyPrefs?: ProviderKeyPrefs;
  onProviderKeyPreferenceChange?: (provider: ModelProvider, preference: ProviderKeyPreference) => void;
};

export function ModelSelectorField({
  providers,
  selectedProvider,
  selectorId = "workbench-model-selector",
  value,
  onSelectModel,
  customModels = [],
  onAddCustomModel,
  onRemoveCustomModel,
  providerKeyPrefs,
  onProviderKeyPreferenceChange,
}: ModelSelectorFieldProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "add">("list");
  const [collapsedProviders, setCollapsedProviders] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");

  const toggleCollapsed = (provider: string) => {
    setCollapsedProviders((current) => {
      const next = new Set(current);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };
  const [customProvider, setCustomProvider] = useState<ProviderOption>(selectedProvider);
  const [customModel, setCustomModel] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProviders = providers
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((model) => model.id.toLowerCase().includes(normalizedQuery)),
    }))
    .filter((provider) => normalizedQuery === "" || provider.models.length > 0);

  const custom = isCustomModel(value.model, value.provider);
  const capabilities = getModelCapabilities(value.model, value.provider);
  const filteredSavedModels = customModels.filter(
    (saved) => normalizedQuery === "" || saved.model.toLowerCase().includes(normalizedQuery),
  );

  const closeAll = () => {
    setSelectorOpen(false);
    setMode("list");
    setQuery("");
    setCustomModel("");
  };

  const selectPreset = (provider: ProviderOption, model: string) => {
    onSelectModel(provider, model);
    closeAll();
  };

  const openAddMode = () => {
    setCustomProvider(selectedProvider);
    setCustomModel("");
    setMode("add");
  };

  const addCustom = () => {
    const trimmed = customModel.trim();
    if (!trimmed) {
      return;
    }
    if (onAddCustomModel) {
      // Authenticated: persist to the account (the panel also selects it).
      onAddCustomModel(customProvider.provider, trimmed, customProvider.defaultBaseURL);
    } else {
      onSelectModel(customProvider, trimmed);
    }
    closeAll();
  };

  const selectSavedModel = (saved: SelectorCustomModel) => {
    const provider = getProviderOption(saved.provider) ?? selectedProvider;
    onSelectModel(provider, saved.model);
    closeAll();
  };

  return (
    <Field label="Model">
      <Popover
        id={selectorId}
        open={selectorOpen}
        onOpenChange={(next) => (next ? setSelectorOpen(true) : closeAll())}
        placement="bottom-start"
        matchReferenceWidth
        renderTrigger={({ ref, props }) => (
          <Button
            {...props}
            ref={ref}
            variant="modelTrigger"
            size="unstyled"
            onClick={() => setSelectorOpen((current) => !current)}
            aria-label="Choose model provider and model"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              <ModelProviderLogo provider={value.provider} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{value.model}</span>
                {custom && <CustomBadge />}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{selectedProvider.label}</span>
            </span>
            <ModelCapabilityTags capabilities={capabilities} />
            <ChevronDown size={16} className="text-muted-foreground" aria-hidden />
          </Button>
        )}
      >
        <div className="overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl shadow-black/20">
          {mode === "list" ? (
            <>
              <div className="border-b border-border p-3">
                <label className={FIELD_SHELL_CLASS}>
                  <Search size={16} className="text-muted-foreground" aria-hidden />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className={FIELD_SHELL_INPUT_CLASS}
                    placeholder="Search model"
                  />
                </label>
              </div>
              <div className="max-h-72 overflow-y-auto py-2">
                {filteredSavedModels.length > 0 && (
                  <SavedModelGroup
                    models={filteredSavedModels}
                    value={value}
                    onSelect={selectSavedModel}
                    onRemove={onRemoveCustomModel}
                  />
                )}
                {filteredProviders.map((provider) => (
                  <ModelGroup
                    key={provider.provider}
                    provider={provider}
                    value={value}
                    onSelect={selectPreset}
                    collapsed={normalizedQuery === "" && collapsedProviders.has(provider.provider)}
                    onToggleCollapse={() => toggleCollapsed(provider.provider)}
                    preference={providerKeyPrefs?.[provider.provider]}
                    onPreferenceChange={
                      onProviderKeyPreferenceChange
                        ? (preference) => onProviderKeyPreferenceChange(provider.provider, preference)
                        : undefined
                    }
                  />
                ))}
                {filteredProviders.length === 0 && filteredSavedModels.length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted-foreground">No models found.</p>
                )}
              </div>
              <div className="border-t border-border p-2">
                <Button
                  variant="ghost"
                  size="unstyled"
                  className="h-9 w-full justify-start gap-2 px-2 text-sm text-brand"
                  onClick={openAddMode}
                >
                  <Plus size={16} aria-hidden /> Add custom model
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="unstyled"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setMode("list")}
                >
                  <ArrowLeft size={14} aria-hidden /> Back
                </Button>
                <span className="text-sm font-semibold">Custom model</span>
              </div>
              <Field label="Based on provider">
                <ProviderPicker
                  id={`${selectorId}-custom-provider`}
                  providers={providers}
                  value={customProvider}
                  onChange={setCustomProvider}
                />
              </Field>
              <Field label="Model name">
                <Input
                  value={customModel}
                  onChange={(event) => setCustomModel(event.target.value)}
                  className={FIELD_INPUT_CLASS}
                  placeholder={`e.g. ${customProvider.defaultModel}`}
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustom();
                    }
                  }}
                />
              </Field>
              <p className="text-[11px] text-muted-foreground">Routed through the {customProvider.label} API.</p>
              <Button variant="success" fullWidth disabled={!customModel.trim()} onClick={addCustom}>
                Add &amp; use
              </Button>
            </div>
          )}
        </div>
      </Popover>
    </Field>
  );
}

function ModelGroup({
  provider,
  value,
  onSelect,
  collapsed,
  onToggleCollapse,
  preference,
  onPreferenceChange,
}: {
  provider: ProviderOption;
  value: OpenAICompatibleSettings;
  onSelect: (provider: ProviderOption, model: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  preference?: ProviderKeyPreference;
  onPreferenceChange?: (preference: ProviderKeyPreference) => void;
}) {
  return (
    <div className="pb-2">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <Button
          variant="ghost"
          size="unstyled"
          className="h-6 min-w-0 flex-1 !justify-start gap-1.5 px-2 text-xs font-semibold text-muted-foreground"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
          <span className="truncate">{provider.label}</span>
        </Button>
        {onPreferenceChange && provider.provider !== "ollama" && (
          <ProviderApiKeyControl
            provider={provider.provider}
            preference={preference}
            onPreferenceChange={onPreferenceChange}
          />
        )}
      </div>
      {collapsed ? null : (
      <div className="space-y-1 px-2">
        {provider.models.map((model) => {
          const selected = provider.provider === value.provider && model.id === value.model;
          return (
            <Button
              key={model.id}
              variant="modelOption"
              size="unstyled"
              onClick={() => onSelect(provider, model.id)}
              className="px-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <ModelProviderLogo provider={provider.provider} />
              </span>
              <span className="min-w-0 flex-1 truncate">{model.id}</span>
              <ModelCapabilityTags capabilities={model.capabilities} />
              {selected && <Check size={16} className="text-brand" aria-hidden />}
            </Button>
          );
        })}
      </div>
      )}
    </div>
  );
}

function SavedModelGroup({
  models,
  value,
  onSelect,
  onRemove,
}: {
  models: SelectorCustomModel[];
  value: OpenAICompatibleSettings;
  onSelect: (model: SelectorCustomModel) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="pb-2">
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground">
        <span>Your models</span>
      </div>
      <div className="space-y-1 px-2">
        {models.map((saved) => {
          const selected = saved.provider === value.provider && saved.model === value.model;
          return (
            <div key={saved.id} className="group/saved flex items-center gap-1">
              <Button
                variant="modelOption"
                size="unstyled"
                onClick={() => onSelect(saved)}
                className="min-w-0 flex-1 px-2"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                  <ModelProviderLogo provider={saved.provider} />
                </span>
                <span className="min-w-0 flex-1 truncate">{saved.model}</span>
                <CustomBadge />
                {selected && <Check size={16} className="text-brand" aria-hidden />}
              </Button>
              {onRemove && (
                <Button
                  variant="ghost"
                  size="iconMd"
                  aria-label={`Remove ${saved.model}`}
                  className="opacity-0 group-hover/saved:opacity-100"
                  onClick={() => onRemove(saved.id)}
                >
                  <Trash2 size={14} aria-hidden />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomBadge() {
  return (
    <Badge variant="outline" className="shrink-0 border-brand/40 px-1.5 py-0 text-[10px] font-medium text-brand">
      Custom
    </Badge>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
