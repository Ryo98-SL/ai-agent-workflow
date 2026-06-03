import type { ModelProviderKeys, OpenAICompatibleSettings } from "@ai-agent-workflow/workflow-domain";
import { ModelSettingsEditor } from "./ModelSettingsEditor";
import { PROVIDER_OPTIONS } from "./modelCatalog";

type ModelSettingsPanelProps = {
  settings?: OpenAICompatibleSettings;
  providerKeys?: ModelProviderKeys;
  showDevModelProviders?: boolean;
  onChange: (settings: OpenAICompatibleSettings, providerKeys: ModelProviderKeys) => void;
};

export const DEFAULT_MODEL_SETTINGS: OpenAICompatibleSettings = {
  provider: "deepseek",
  baseURL: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  apiKey: "",
};

export function ModelSettingsPanel({
  settings,
  providerKeys = {},
  showDevModelProviders = false,
  onChange,
}: ModelSettingsPanelProps) {
  const availableProviders = PROVIDER_OPTIONS.filter((option) => showDevModelProviders || !option.devOnly);
  const rawValue = settings || DEFAULT_MODEL_SETTINGS;
  const value = availableProviders.some((option) => option.provider === rawValue.provider) ? rawValue : DEFAULT_MODEL_SETTINGS;

  const updateSettings = (nextSettings: OpenAICompatibleSettings) => {
    onChange({ ...nextSettings, apiKey: undefined }, providerKeys);
  };

  const updateApiKey = (apiKey: string) => {
    onChange(
      { ...value, apiKey: undefined },
      {
        ...providerKeys,
        [value.provider]: apiKey || undefined,
      },
    );
  };

  return (
    <section className="p-4">
      <ModelSettingsEditor
        settings={{ ...value, apiKey: undefined }}
        selectorId="workbench-global-model-selector"
        apiKey={providerKeys[value.provider] || value.apiKey || ""}
        apiKeyPlaceholder="Stored for this provider"
        showDevModelProviders={showDevModelProviders}
        onApiKeyChange={updateApiKey}
        onChange={(nextSettings) => updateSettings(nextSettings as OpenAICompatibleSettings)}
      />
    </section>
  );
}
