import type { ModelProvider, ModelProviderKeys, OpenAICompatibleSettings } from "@ai-agent-workflow/workflow-domain";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { FIELD_SHELL_CLASS, FIELD_SHELL_INPUT_CLASS } from "./fieldStyles";
import { ModelSettingsEditor, type SelectorCustomModel } from "./ModelSettingsEditor";
import { PROVIDER_OPTIONS } from "./modelCatalog";
import { Button } from "./Button";
import {
  useCreateCustomModel,
  useCustomModels,
  useDeleteCustomModel,
  useDeleteProviderKey,
  useProviderKeys,
  usePutProviderKey,
  useSession,
} from "../../data/useAccount";

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

  const updateSettings = (nextSettings: OpenAICompatibleSettings) => {
    onChange({ ...nextSettings, apiKey: undefined }, providerKeys);
  };

  // Anonymous fallback: store the key transiently on the workflow.
  const updateTransientApiKey = (apiKey: string) => {
    onChange(
      { ...value, apiKey: undefined },
      {
        ...providerKeys,
        [value.provider]: apiKey || undefined,
      },
    );
  };

  // Authed: persist the custom model to the account, then select it.
  const addServerCustomModel = (provider: ModelProvider, model: string, baseURL?: string) => {
    createCustomModel.mutate({ provider, model, baseURL });
    onChange({ ...value, provider, model, baseURL: baseURL ?? value.baseURL, apiKey: undefined }, providerKeys);
  };

  return (
    <section className="p-4">
      <ModelSettingsEditor
        settings={{ ...value, apiKey: undefined }}
        selectorId="workbench-global-model-selector"
        apiKey={isAuthed ? "" : providerKeys[value.provider] || value.apiKey || ""}
        apiKeyPlaceholder="Stored for this provider"
        showDevModelProviders={showDevModelProviders}
        onApiKeyChange={isAuthed ? undefined : updateTransientApiKey}
        onChange={(nextSettings) => updateSettings(nextSettings as OpenAICompatibleSettings)}
        customModels={serverCustomModels}
        onAddCustomModel={isAuthed ? addServerCustomModel : undefined}
        onRemoveCustomModel={isAuthed ? (id) => deleteCustomModel.mutate(id) : undefined}
        renderApiKeyField={
          isAuthed && value.provider !== "ollama"
            ? () => <ManagedApiKeyField provider={value.provider} />
            : undefined
        }
      />
    </section>
  );
}

/**
 * API key field for authenticated users. The plaintext key is sent to the
 * server (encrypted at rest) and never read back — only a masked `last4`.
 */
function ManagedApiKeyField({ provider }: { provider: ModelProvider }) {
  const { data, isLoading } = useProviderKeys();
  const putKey = usePutProviderKey();
  const deleteKey = useDeleteProviderKey();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  const stored = data?.keys.find((key) => key.provider === provider);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" aria-hidden /> Loading key…
      </div>
    );
  }

  if (stored && !editing) {
    return (
      <div className="flex items-center gap-2">
        <div className={`${FIELD_SHELL_CLASS} flex-1`}>
          <KeyRound size={14} className="text-muted-foreground" aria-hidden />
          <span className="flex-1 text-sm text-foreground">••••{stored.last4}</span>
          <span className="text-[11px] text-muted-foreground">stored</span>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Replace
        </Button>
        <Button
          variant="ghost"
          size="iconMd"
          aria-label="Remove stored key"
          disabled={deleteKey.isPending}
          onClick={() => deleteKey.mutate(provider)}
        >
          <Trash2 size={15} aria-hidden />
        </Button>
      </div>
    );
  }

  const save = () => {
    const apiKey = draft.trim();
    if (!apiKey) return;
    putKey.mutate(
      { provider, apiKey },
      {
        onSuccess: () => {
          setDraft("");
          setEditing(false);
        },
      },
    );
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`${FIELD_SHELL_CLASS} flex-1`}>
        <KeyRound size={14} className="text-muted-foreground" aria-hidden />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className={FIELD_SHELL_INPUT_CLASS}
          placeholder="Paste API key — saved to your account"
          type="password"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
        />
      </div>
      <Button variant="success" size="sm" disabled={!draft.trim() || putKey.isPending} onClick={save}>
        {putKey.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : "Save"}
      </Button>
      {stored && (
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      )}
    </div>
  );
}
