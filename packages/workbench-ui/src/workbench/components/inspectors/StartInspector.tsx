import type { ReactNode } from "react";
import type { StartNode, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import { Button } from "../Button";

type StartInspectorProps = {
  node: StartNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

const FIELD_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function StartInspector({ node, updateNode }: StartInspectorProps) {
  const names = node.config.fields.map((field) => field.name);

  const updateConfig = (fields: StartNode["config"]["fields"]) => {
    updateNode(node.id, (current) => (current.type === "start" ? { ...current, config: { fields } } : current));
  };

  const updateField = (index: number, patch: Partial<StartNode["config"]["fields"][number]>) => {
    updateConfig(node.config.fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)));
  };

  const addField = () => {
    let index = node.config.fields.length + 1;
    while (names.includes(`field${index}`)) {
      index += 1;
    }
    updateConfig([ { name: `field${index}`, label: `Field ${index}`, required: false }, ...node.config.fields]);
  };

  const removeField = (index: number) => {
    updateConfig(node.config.fields.filter((_field, fieldIndex) => fieldIndex !== index));
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
            updateNode(node.id, (current) => (current.type === "start" ? { ...current, label: event.target.value } : current))
          }
          className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={node.description || ""}
          onChange={(event) =>
            updateNode(node.id, (current) =>
              current.type === "start" ? { ...current, description: event.target.value || undefined } : current,
            )
          }
          className="min-h-20 w-full resize-y rounded-md border border-slate-200 p-2 text-sm leading-5"
        />
      </Field>
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Input Fields</h3>
          <Button
            variant="successSoft"
            size="sm"
            onClick={addField}
          >
            Add field
          </Button>
        </div>
        {node.config.fields.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">No Start inputs configured.</p>
        ) : (
          <div className="space-y-3">
            {node.config.fields.map((field, index) => {
              const duplicate = names.indexOf(field.name) !== index;
              const invalid = !FIELD_NAME_PATTERN.test(field.name);
              return (
                <div key={index} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name">
                      <input
                        value={field.name}
                        onChange={(event) => updateField(index, { name: event.target.value })}
                        className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                      />
                    </Field>
                    <Field label="Label">
                      <input
                        value={field.label || ""}
                        onChange={(event) => updateField(index, { label: event.target.value || undefined })}
                        className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                      />
                    </Field>
                  </div>
                  {(invalid || duplicate) && (
                    <p className="mt-2 text-xs text-rose-600">
                      {duplicate ? "Field names must be unique." : "Use letters, numbers, and underscores only."}
                    </p>
                  )}
                  <Field label="Default value">
                    <input
                      value={field.defaultValue || ""}
                      onChange={(event) => updateField(index, { defaultValue: event.target.value || undefined })}
                      className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                    />
                  </Field>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        checked={field.required}
                        onChange={(event) => updateField(index, { required: event.target.checked })}
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      />
                      Required
                    </label>
                    <Button variant="dangerGhost" size="sm" onClick={() => removeField(index)}>
                      Remove
                    </Button>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
