import { ChevronDown, KeyRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { LLMModelSettings, OpenAICompatibleSettings } from "@ai-agent-workflow/workflow-domain";
import { Button } from "./Button";
import { ModelSelectorField } from "./ModelSelectorField";
import { getProviderOption, PROVIDER_OPTIONS, type ProviderOption } from "./modelCatalog";

export type EditableModelSettings = OpenAICompatibleSettings | LLMModelSettings;

type ModelSettingsEditorProps = {
  settings: EditableModelSettings;
  showDevModelProviders?: boolean;
  selectorId: string;
  apiKey?: string;
  apiKeyPlaceholder?: string;
  showAdvanced?: boolean;
  onApiKeyChange?: (apiKey: string) => void;
  onChange: (settings: EditableModelSettings) => void;
};

export function ModelSettingsEditor({
  settings,
  showDevModelProviders = false,
  selectorId,
  apiKey,
  apiKeyPlaceholder = "Stored with this workflow",
  showAdvanced = false,
  onApiKeyChange,
  onChange,
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
  const selectedApiKey = apiKey ?? settings.apiKey ?? "";

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

  const changeApiKey = (nextApiKey: string) => {
    if (onApiKeyChange) {
      onApiKeyChange(nextApiKey);
      return;
    }

    update({ apiKey: nextApiKey || undefined });
  };

  return (
    <div className="space-y-3">
      <ModelSelectorField
        providers={availableProviders}
        selectedProvider={selectedProvider}
        selectorId={selectorId}
        value={settings}
        onModelNameChange={(model) => update({ model })}
        onSelectModel={selectModel}
      />

      <Field label="Base URL">
        <input
          value={settings.baseURL}
          onChange={(event) => update({ baseURL: event.target.value })}
          className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
          placeholder={selectedProvider.defaultBaseURL}
        />
      </Field>

      {settings.provider !== "ollama" && (
        <Field label="API Key">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 px-2">
            <KeyRound size={14} className="text-slate-400" aria-hidden />
            <input
              value={selectedApiKey}
              onChange={(event) => changeApiKey(event.target.value)}
              className="h-9 min-w-0 flex-1 text-sm outline-none"
              placeholder={apiKeyPlaceholder}
              type="password"
            />
          </div>
        </Field>
      )}

      {showAdvanced && (
        <section className="rounded-md border border-slate-200 bg-slate-50">
          <Button
            variant="ghost"
            size="unstyled"
            className="flex h-10 w-full items-center justify-between px-3 text-sm font-semibold text-slate-700"
            onClick={() => setAdvancedOpen((current) => !current)}
            aria-expanded={advancedOpen}
          >
            <span>Advanced</span>
            <ChevronDown
              size={16}
              className={["text-slate-400 transition-transform", advancedOpen ? "rotate-180" : ""].join(" ")}
              aria-hidden
            />
          </Button>
          {advancedOpen && (
            <div className="grid grid-cols-2 gap-3 border-t border-slate-200 p-3">
              <Field label="Temperature">
                <input
                  value={(settings as LLMModelSettings).temperature ?? 0.7}
                  onChange={(event) => update({ temperature: Number(event.target.value) })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                  min={0}
                  max={2}
                  step={0.1}
                  type="number"
                />
              </Field>
              <Field label="Max tokens">
                <input
                  value={(settings as LLMModelSettings).maxTokens ?? 800}
                  onChange={(event) => update({ maxTokens: Number(event.target.value) })}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
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
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
