import type { WorkflowNode } from "../../../domain/workflow/schema";

type UnsupportedInspectorProps = {
  node: WorkflowNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function UnsupportedInspector({ node, updateNode }: UnsupportedInspectorProps) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Label</span>
        <input
          value={node.label}
          onChange={(event) => updateNode(node.id, (current) => ({ ...current, label: event.target.value }))}
          className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
        />
      </label>
      <p className="rounded-md bg-slate-50 p-3 text-sm leading-5 text-slate-600">
        This node type is part of the durable workflow schema, but real execution is deferred beyond the MVP.
      </p>
    </div>
  );
}
