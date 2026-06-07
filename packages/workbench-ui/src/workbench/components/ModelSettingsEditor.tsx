import { ChevronDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type {
  ModelProvider,
  OpenAICompatibleSettings,
  ProviderKeyPreference,
  ProviderKeyPrefs,
} from "@ai-agent-workflow/workflow-domain";
import { Input } from "@workbench/components/ui/input";
import { Button } from "./Button";
import { FIELD_INPUT_CLASS } from "./fieldStyles";
import { ModelSelectorField } from "./ModelSelectorField";
import { getProviderOption, PROVIDER_OPTIONS, type ProviderOption } from "./modelCatalog";

export type EditableModelSettings = OpenAICompatibleSettings;

/** A user-saved custom model surfaced in the selector (authenticated users). */
export type SelectorCustomModel = {
  id: string;
  provider: ModelProvider;
  model: string;
  baseURL?: string;
};

type ModelSettingsEditorProps = {
  settings: EditableModelSettings;
  showDevModelProviders?: boolean;
  selectorId: string;
  showAdvanced?: boolean;
  onChange: (settings: EditableModelSettings) => void;
  /** User-saved custom models to show in the selector. */
  customModels?: SelectorCustomModel[];
  /** When provided, "Add custom model" persists via this instead of just selecting. */
  onAddCustomModel?: (provider: ModelProvider, model: string, baseURL?: string) => void;
  onRemoveCustomModel?: (id: string) => void;
  /** Per-provider API key selection persisted in workflow settings. */
  providerKeyPrefs?: ProviderKeyPrefs;
  onProviderKeyPreferenceChange?: (provider: ModelProvider, preference: ProviderKeyPreference) => void;
};

export function ModelSettingsEditor({
  settings,
  showDevModelProviders = false,
  selectorId,
  showAdvanced = false,
  onChange,
  customModels,
  onAddCustomModel,
  onRemoveCustomModel,
  providerKeyPrefs,
  onProviderKeyPreferenceChange,
}: ModelSettingsEditorProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const availableProviders = useMemo(
    () => PROVIDER_OPTIONS.filter((option) => showDevModelProviders || !option.devOnly),
    [showDevModelProviders],
  );
  const selectedProvider =
    availableProviders.find((option) => option.provider === settings.provider) ||
    getProviderOption(settings.provider) ||
    PROVIDER_OPTIONS[0];
  const update = (patch: Partial<EditableModelSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const selectModel = (provider: ProviderOption, model: string) => {
    onChange({
      ...settings,
      provider: provider.provider,
      baseURL: settings.provider === provider.provider ? settings.baseURL : provider.defaultBaseURL,
      model,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ModelSelectorField
        providers={availableProviders}
        selectedProvider={selectedProvider}
        selectorId={selectorId}
        value={settings}
        onSelectModel={selectModel}
        customModels={customModels}
        onAddCustomModel={onAddCustomModel}
        onRemoveCustomModel={onRemoveCustomModel}
        providerKeyPrefs={providerKeyPrefs}
        onProviderKeyPreferenceChange={onProviderKeyPreferenceChange}
      />

      <Field label="Custom API endpoint URL (optional)">
        <Input
          value={settings.baseURL}
          onChange={(event) => update({ baseURL: event.target.value })}
          className={FIELD_INPUT_CLASS}
          placeholder={selectedProvider.defaultBaseURL}
        />
      </Field>

      {showAdvanced && (
        <section className="rounded-md border border-border bg-muted/50">
          <Button
            variant="ghost"
            size="unstyled"
            className="flex h-10 w-full items-center justify-between px-3 text-sm font-semibold text-foreground"
            onClick={() => setAdvancedOpen((current) => !current)}
            aria-expanded={advancedOpen}
          >
            <span>Advanced</span>
            <ChevronDown
              size={16}
              className={["text-muted-foreground transition-transform", advancedOpen ? "rotate-180" : ""].join(" ")}
              aria-hidden
            />
          </Button>
          {advancedOpen && (
            <div className="grid grid-cols-2 gap-3 border-t border-border p-3">
              <Field label="Temperature">
                <Input
                  value={settings.temperature ?? 0.7}
                  onChange={(event) => update({ temperature: Number(event.target.value) })}
                  className={FIELD_INPUT_CLASS}
                  min={0}
                  max={2}
                  step={0.1}
                  type="number"
                />
              </Field>
              <Field label="Max tokens">
                <Input
                  value={settings.maxTokens ?? 800}
                  onChange={(event) => update({ maxTokens: Number(event.target.value) })}
                  className={FIELD_INPUT_CLASS}
                  min={1}
                  type="number"
                />
              </Field>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
