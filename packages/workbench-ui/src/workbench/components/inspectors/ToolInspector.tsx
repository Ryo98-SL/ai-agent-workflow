import type { ReactNode } from "react";
import type { ToolNode, WorkflowNode } from "@ai-agent-workflow/workflow-domain";

type ToolInspectorProps = {
  node: ToolNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function ToolInspector({ node, updateNode }: ToolInspectorProps) {
  const updateConfig = (patch: Partial<ToolNode["config"]>) => {
    updateNode(node.id, (current) =>
      current.type === "tool" ? { ...current, config: { ...current.config, ...patch } } : current,
    );
  };

  return (
    <div className="space-y-4">
      <Field label="Label">
        <input
          value={node.label}
          onChange={(event) =>
            updateNode(node.id, (current) => (current.type === "tool" ? { ...current, label: event.target.value } : current))
          }
          className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
        />
      </Field>
      <Field label="Adapter">
        <select
          value={node.config.adapter}
          onChange={(event) => updateConfig({ adapter: event.target.value as ToolNode["config"]["adapter"] })}
          className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
        >
          <option value="currentTime">Current Time</option>
        </select>
      </Field>
      <Field label="Timezone">
        <input
          value={node.config.timezone}
          onChange={(event) => updateConfig({ timezone: event.target.value })}
          className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
          placeholder="UTC"
        />
      </Field>
      <p className="rounded-md bg-emerald-50 p-3 text-sm leading-5 text-emerald-800">
        This built-in tool returns the current time through the same runtime boundary as the LLM adapter.
      </p>
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
