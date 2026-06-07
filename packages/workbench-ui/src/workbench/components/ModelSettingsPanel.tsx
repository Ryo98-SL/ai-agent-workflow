import type {
  LLMModelSettings,
  ModelProvider,
  ModelProviderKeys,
  OpenAICompatibleSettings,
  ProviderKeyPreference,
  ProviderKeyPrefs,
} from "@ai-agent-workflow/workflow-domain";
import { useMemo } from "react";
import { ModelSettingsEditor, type SelectorCustomModel } from "./ModelSettingsEditor";
import { PROVIDER_OPTIONS } from "./modelCatalog";
import {
  useCreateCustomModel,
  useCustomModels,
  useDeleteCustomModel,
  useSession,
} from "../../data/useAccount";

type ModelSettingsPanelProps = {
  settings?: OpenAICompatibleSettings | LLMModelSettings;
  providerKeys?: ModelProviderKeys;
  providerKeyPrefs?: ProviderKeyPrefs;
  showDevModelProviders?: boolean;
  className?: string;
  selectorId?: string;
  onChange: (settings: OpenAICompatibleSettings, providerKeys: ModelProviderKeys) => void;
  onProviderKeyPreferenceChange?: (provider: ModelProvider, preference: ProviderKeyPreference) => void;
};

export const DEFAULT_MODEL_SETTINGS: OpenAICompatibleSettings = {
  provider: "deepseek",
  baseURL: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  temperature: 0.7,
  maxTokens: 800,
};

export function ModelSettingsPanel({
  settings,
  providerKeys = {},
  providerKeyPrefs,
  showDevModelProviders = false,
  className = "p-4",
  selectorId = "workbench-global-model-selector",
  onChange,
  onProviderKeyPreferenceChange,
}: ModelSettingsPanelProps) {
  const { data: session } = useSession();
  const isAuthed = Boolean(session?.user);

  const availableProviders = PROVIDER_OPTIONS.filter((option) => showDevModelProviders || !option.devOnly);
  const rawValue = settings || DEFAULT_MODEL_SETTINGS;
  const value = availableProviders.some((option) => option.provider === rawValue.provider) ? rawValue : DEFAULT_MODEL_SETTINGS;

  const customModelsQuery = useCustomModels();
  const createCustomModel = useCreateCustomModel();
  const deleteCustomModel = useDeleteCustomModel();

  const serverCustomModels = useMemo<SelectorCustomModel[]>(
    () =>
      isAuthed
        ? (customModelsQuery.data?.models ?? []).map((model) => ({
            id: model.id,
            provider: model.provider as ModelProvider,
            model: model.model,
            baseURL: model.baseURL ?? undefined,
          }))
        : [],
    [isAuthed, customModelsQuery.data],
  );

  const updateSettings = (nextSettings: OpenAICompatibleSettings | LLMModelSettings) => {
    onChange(stripInlineApiKey(nextSettings), providerKeys);
  };

  // Authed: persist the custom model to the account, then select it.
  const addServerCustomModel = (provider: ModelProvider, model: string, baseURL?: string) => {
    createCustomModel.mutate({ provider, model, baseURL });
    onChange(stripInlineApiKey({ ...value, provider, model, baseURL: baseURL ?? value.baseURL }), providerKeys);
  };

  return (
    <section className={className}>
      <ModelSettingsEditor
        settings={stripInlineApiKey(value)}
        selectorId={selectorId}
        showDevModelProviders={showDevModelProviders}
        showAdvanced
        onChange={(nextSettings) => updateSettings(nextSettings as OpenAICompatibleSettings)}
        customModels={serverCustomModels}
        onAddCustomModel={isAuthed ? addServerCustomModel : undefined}
        onRemoveCustomModel={isAuthed ? (id) => deleteCustomModel.mutate(id) : undefined}
        providerKeyPrefs={providerKeyPrefs}
        onProviderKeyPreferenceChange={onProviderKeyPreferenceChange}
      />
    </section>
  );
}

function stripInlineApiKey(settings: OpenAICompatibleSettings | LLMModelSettings): OpenAICompatibleSettings {
  return { ...settings, apiKey: undefined };
}
