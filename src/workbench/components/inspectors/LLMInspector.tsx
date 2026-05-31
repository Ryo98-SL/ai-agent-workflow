import type { ReactNode } from "react";
import { parsePromptVariables } from "../../../domain/workflow/promptVariables";
import type { LLMNode, WorkflowNode } from "../../../domain/workflow/schema";

type LLMInspectorProps = {
  node: LLMNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function LLMInspector({ node, updateNode }: LLMInspectorProps) {
  const prompts = `${node.config.systemPrompt || ""}\n${node.config.userPrompt}`;
  const variables = parsePromptVariables(prompts);

  const updateConfig = (patch: Partial<LLMNode["config"]>) => {
    updateNode(node.id, (current) =>
      current.type === "llm" ? { ...current, config: { ...current.config, ...patch } } : current,
    );
  };

  const updateVariable = (name: string, value: string) => {
    updateConfig({ variables: { ...node.config.variables, [name]: value } });
  };

  return (
    <div className="space-y-4">
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
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">Use {"{{variable}}"} in prompts.</p>
        ) : (
          <div className="space-y-2">
            {variables.map((variable) => (
              <Field key={variable} label={variable}>
                <input
                  value={node.config.variables[variable] || ""}
                  onChange={(event) => updateVariable(variable, event.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                />
              </Field>
            ))}
          </div>
        )}
      </section>
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
