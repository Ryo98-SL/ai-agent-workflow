import type { WorkflowNode } from "@ai-agent-workflow/workflow-domain";

type UnsupportedInspectorProps = {
  node: WorkflowNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function UnsupportedInspector({ node }: UnsupportedInspectorProps) {
  return (
    <div className="space-y-4">
      <p className="rounded-md bg-muted p-3 text-sm leading-5 text-muted-foreground">
        This {node.type} node type is part of the durable workflow schema, but real execution is deferred beyond the
        MVP.
      </p>
    </div>
  );
}
