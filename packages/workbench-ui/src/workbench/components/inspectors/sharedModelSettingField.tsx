import { useState } from "react";
import { resolveLLMModelSettings } from "@ai-agent-workflow/workflow-domain";
import type {
  LLMModelSettings,
  LLMNode,
  ModelProvider,
  ProviderKeyPreference,
  WorkflowFile,
} from "@ai-agent-workflow/workflow-domain";
import { Button } from "../Button";
import { ModelCapabilityTags } from "../ModelCapabilityTags";
import { DEFAULT_MODEL_SETTINGS, ModelSettingsPanel } from "../ModelSettingsPanel";
import { getModelCapabilities } from "../modelCatalog";
import { ModelProviderLogo } from "../modelProviderVisuals";
import { Popover } from "../Popover";

/**
 * Minimal node shape the model field reads. LLM and Agent nodes both carry these
 * `config` fields, so the field (and `resolveLLMModelSettings`) work for either.
 */
export type ModelSettingNode = {
  id: string;
  config: { model?: string; modelSettings?: LLMModelSettings; temperature?: number; maxTokens?: number };
};

/** Resolved editor settings for a node, layering node override → resolved → workflow default. */
export function modelSettingsForEditor(workflow: WorkflowFile, node: ModelSettingNode): LLMModelSettings {
  const workflowDefault = workflow.settings.modelProvider || DEFAULT_MODEL_SETTINGS;
  // resolveLLMModelSettings only reads the shared config fields below.
  const resolved = resolveLLMModelSettings(workflow, node as unknown as LLMNode);

  return {
    provider: node.config.modelSettings?.provider || resolved?.provider || workflowDefault.provider,
    baseURL: node.config.modelSettings?.baseURL || resolved?.baseURL || workflowDefault.baseURL,
    model: node.config.modelSettings?.model || resolved?.model || node.config.model || workflowDefault.model,
    temperature: node.config.modelSettings?.temperature ?? resolved?.temperature ?? node.config.temperature ?? 0.7,
    maxTokens: node.config.modelSettings?.maxTokens ?? resolved?.maxTokens ?? node.config.maxTokens ?? 800,
  };
}

export function sanitizeNodeModelSettings(settings: LLMModelSettings): LLMModelSettings {
  return {
    provider: settings.provider,
    baseURL: settings.baseURL,
    model: settings.model,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  };
}

/**
 * Per-node model selector: a popover trigger showing the resolved model + a
 * {@link ModelSettingsPanel} to override it. Shared by the LLM and Agent inspectors.
 */
export function NodeModelSettingField({
  hasModelOverride,
  modelSettings,
  nodeId,
  workflow,
  showDevModelProviders,
  onProviderKeyPreferenceChange,
  onChange,
  onReset,
}: {
  hasModelOverride: boolean;
  modelSettings: LLMModelSettings;
  nodeId: string;
  workflow: WorkflowFile;
  showDevModelProviders: boolean;
  onProviderKeyPreferenceChange?: (provider: ModelProvider, preference: ProviderKeyPreference) => void;
  onChange: (settings: LLMModelSettings) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const capabilities = getModelCapabilities(modelSettings.model, modelSettings.provider);

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">Model Setting</span>
      <Popover
        id={`node-model-setting-${nodeId}`}
        open={open}
        onOpenChange={setOpen}
        placement="bottom-start"
        renderTrigger={({ ref, props }) => (
          <Button
            {...props}
            ref={ref}
            variant="modelTrigger"
            size="unstyled"
            className={`!px-2 !h-10`}
            onClick={() => setOpen((current) => !current)}
            aria-label="Open model setting"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              <ModelProviderLogo provider={modelSettings.provider} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{modelSettings.model}</span>
            </span>
            <ModelCapabilityTags capabilities={capabilities} />
          </Button>
        )}
      >
        <div className="w-[360px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl shadow-black/20">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Model Setting</h3>
            <Button variant="ghost" size="sm" onClick={onReset} disabled={!hasModelOverride}>
              Use workflow default
            </Button>
          </div>
          <div>
            <ModelSettingsPanel
              settings={modelSettings}
              selectorId={`node-model-selector-${nodeId}`}
              providerKeyPrefs={workflow.settings.providerKeyPrefs}
              showDevModelProviders={showDevModelProviders}
              className="p-4"
              onProviderKeyPreferenceChange={onProviderKeyPreferenceChange}
              onChange={(nextSettings) => onChange(nextSettings as LLMModelSettings)}
            />
          </div>
        </div>
      </Popover>
    </div>
  );
}
