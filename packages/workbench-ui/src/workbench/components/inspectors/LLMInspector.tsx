import type { ReactNode } from "react";
import { parsePromptVariableReferences } from "@ai-agent-workflow/workflow-domain";
import type { LLMNode, WorkflowFile, WorkflowNode } from "@ai-agent-workflow/workflow-domain";

type LLMInspectorProps = {
  workflow: WorkflowFile;
  node: LLMNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function LLMInspector({ workflow, node, updateNode }: LLMInspectorProps) {
  const prompts = `${node.config.systemPrompt || ""}\n${node.config.userPrompt}`;
  const variables = parsePromptVariableReferences(prompts);

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
      <Field label="Model override">
        <input
          value={node.config.model || ""}
          onChange={(event) => updateConfig({ model: event.target.value || undefined })}
          className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
          placeholder="Use global model"
        />
      </Field>
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Temperature">
          <input
            value={node.config.temperature ?? 0.7}
            onChange={(event) => updateConfig({ temperature: Number(event.target.value) })}
            className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
            min={0}
            max={2}
            step={0.1}
            type="number"
          />
        </Field>
        <Field label="Max tokens">
          <input
            value={node.config.maxTokens ?? 800}
            onChange={(event) => updateConfig({ maxTokens: Number(event.target.value) })}
            className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
            min={1}
            type="number"
          />
        </Field>
      </div>
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
