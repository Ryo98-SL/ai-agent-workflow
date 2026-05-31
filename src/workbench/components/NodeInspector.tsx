import type { WorkflowNode } from "../../domain/workflow/schema";
import { LLMInspector } from "./inspectors/LLMInspector";
import { ToolInspector } from "./inspectors/ToolInspector";
import { UnsupportedInspector } from "./inspectors/UnsupportedInspector";

type NodeInspectorProps = {
  selectedNode?: WorkflowNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function NodeInspector({ selectedNode, updateNode }: NodeInspectorProps) {
  if (!selectedNode) {
    return (
      <section className="p-4">
        <h2 className="text-sm font-semibold">Inspector</h2>
        <p className="mt-2 text-sm text-slate-500">Select a node to configure it.</p>
      </section>
    );
  }

  return (
    <section className="p-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inspector</p>
        <h2 className="mt-1 truncate text-lg font-semibold">{selectedNode.label}</h2>
      </div>
      {selectedNode.type === "llm" ? (
        <LLMInspector node={selectedNode} updateNode={updateNode} />
      ) : selectedNode.type === "tool" ? (
        <ToolInspector node={selectedNode} updateNode={updateNode} />
      ) : (
        <UnsupportedInspector node={selectedNode} updateNode={updateNode} />
      )}
    </section>
  );
}
