import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { parsePromptVariableReferences, resolveLLMModelSettings } from "@ai-agent-workflow/workflow-domain";
import type { LLMModelSettings, LLMNode, WorkflowFile, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import { Button } from "../Button";
import { ModelCapabilityTags } from "../ModelCapabilityTags";
import { DEFAULT_MODEL_SETTINGS } from "../ModelSettingsPanel";
import { ModelSettingsEditor } from "../ModelSettingsEditor";
import { getModelCapabilities } from "../modelCatalog";
import { ModelProviderLogo } from "../modelProviderVisuals";
import { Popover } from "../Popover";

type LLMInspectorProps = {
  workflow: WorkflowFile;
  node: LLMNode;
  showDevModelProviders?: boolean;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function LLMInspector({ workflow, node, showDevModelProviders = false, updateNode }: LLMInspectorProps) {
  const prompts = `${node.config.systemPrompt || ""}\n${node.config.userPrompt}`;
  const variables = parsePromptVariableReferences(prompts);
  const modelSettings = modelSettingsForEditor(workflow, node);
  const hasModelOverride = Boolean(node.config.modelSettings || node.config.model);

  const updateConfig = (patch: Partial<LLMNode["config"]>) => {
    updateNode(node.id, (current) =>
      current.type === "llm" ? { ...current, config: { ...current.config, ...patch } } : current,
    );
  };

  return (
    <div className="space-y-4">
      <Field label="Node id">
        <input value={node.id} readOnly className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-2 text-sm" />
      </Field>
      <Field label="Label">
        <input
          value={node.label}
          onChange={(event) =>
            updateNode(node.id, (current) => (current.type === "llm" ? { ...current, label: event.target.value } : current))
          }
          className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={node.description || ""}
          onChange={(event) =>
            updateNode(node.id, (current) =>
              current.type === "llm" ? { ...current, description: event.target.value || undefined } : current,
            )
          }
          className="min-h-20 w-full resize-y rounded-md border border-slate-200 p-2 text-sm leading-5"
        />
      </Field>
      <ModelSettingField
        hasModelOverride={hasModelOverride}
        modelSettings={modelSettings}
        nodeId={node.id}
        showDevModelProviders={showDevModelProviders}
        onChange={(nextSettings) =>
          updateConfig({
            model: undefined,
            modelSettings: sanitizeNodeModelSettings(nextSettings),
          })
        }
        onReset={() => updateConfig({ model: undefined, modelSettings: undefined })}
      />
      <Field label="System prompt">
        <textarea
          value={node.config.systemPrompt || ""}
          onChange={(event) => updateConfig({ systemPrompt: event.target.value })}
          className="min-h-24 w-full resize-y rounded-md border border-slate-200 p-2 text-sm leading-5"
        />
      </Field>
      <Field label="User prompt">
        <textarea
          value={node.config.userPrompt}
          onChange={(event) => updateConfig({ userPrompt: event.target.value })}
          className="min-h-28 w-full resize-y rounded-md border border-slate-200 p-2 text-sm leading-5"
        />
      </Field>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt Variables</h3>
        {variables.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">Use {"{{start1.topic}}"} in prompts.</p>
        ) : (
          <div className="space-y-2">
            {variables.map((variable) => {
              const status = variable.ok ? referenceStatus(workflow, variable.nodeId, variable.path) : variable.error;
              return (
                <div key={variable.value} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <code className="truncate text-xs font-semibold text-slate-700">{variable.value}</code>
                    <span
                      className={[
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        status === "resolvable" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800",
                      ].join(" ")}
                    >
                      {status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ModelSettingField({
  hasModelOverride,
  modelSettings,
  nodeId,
  showDevModelProviders,
  onChange,
  onReset,
}: {
  hasModelOverride: boolean;
  modelSettings: LLMModelSettings;
  nodeId: string;
  showDevModelProviders: boolean;
  onChange: (settings: LLMModelSettings) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const capabilities = getModelCapabilities(modelSettings.model, modelSettings.provider);

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-600">Model Setting</span>
      <Popover
        id={`llm-model-setting-${nodeId}`}
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
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
              <ModelProviderLogo provider={modelSettings.provider} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{modelSettings.model}</span>

            </span>
            <ModelCapabilityTags capabilities={capabilities} />
          </Button>
        )}
      >
        <div className="w-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-xl shadow-slate-900/10">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold">Model Setting</h3>
            <Button variant="ghost" size="sm" onClick={onReset} disabled={!hasModelOverride}>
              Use workflow default
            </Button>
          </div>
          <div className="p-4">
            <ModelSettingsEditor
              settings={modelSettings}
              selectorId={`llm-model-selector-${nodeId}`}
              apiKeyPlaceholder="Use provider default key"
              showAdvanced
              showDevModelProviders={showDevModelProviders}
              onChange={(nextSettings) => onChange(nextSettings as LLMModelSettings)}
            />
          </div>
        </div>
      </Popover>
    </div>
  );
}

function modelSettingsForEditor(workflow: WorkflowFile, node: LLMNode): LLMModelSettings {
  const workflowDefault = workflow.settings.modelProvider || DEFAULT_MODEL_SETTINGS;
  const resolved = resolveLLMModelSettings(workflow, node);

  return {
    provider: node.config.modelSettings?.provider || resolved?.provider || workflowDefault.provider,
    baseURL: node.config.modelSettings?.baseURL || resolved?.baseURL || workflowDefault.baseURL,
    model: node.config.modelSettings?.model || resolved?.model || node.config.model || workflowDefault.model,
    apiKey: node.config.modelSettings?.apiKey || "",
    temperature: node.config.modelSettings?.temperature ?? node.config.temperature ?? 0.7,
    maxTokens: node.config.modelSettings?.maxTokens ?? node.config.maxTokens ?? 800,
  };
}

function sanitizeNodeModelSettings(settings: LLMModelSettings): LLMModelSettings {
  return {
    provider: settings.provider,
    baseURL: settings.baseURL,
    model: settings.model,
    apiKey: settings.apiKey || undefined,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  };
}

function referenceStatus(workflow: WorkflowFile, nodeId: string, path: string[]): string {
  const producer = workflow.graph.nodes.find((node) => node.id === nodeId);
  if (!producer) {
    return "missing producer";
  }

  const firstField = path[0];
  if (producer.type === "start" && producer.config.fields.some((field) => field.name === firstField)) {
    return "resolvable";
  }

  if (producer.type === "llm" && ["text", "usage", "reasoning"].includes(firstField)) {
    return "resolvable";
  }

  return "missing field";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
