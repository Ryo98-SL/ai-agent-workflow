import {
  nodeOutputFields,
  workflowNodeOutputFields,
  type WorkflowNode,
  type WorkflowNodeOutputField,
  type WorkflowNodeType,
} from "@ai-agent-workflow/workflow-domain";

// Pass `node` for per-node resolution (Tool nodes resolve outputs from their bound
// descriptor); `nodeType` stays for inspectors keyed only by type.
type NodeOutputVariablesPanelProps = { node: WorkflowNode } | { nodeType: WorkflowNodeType };

export function NodeOutputVariablesPanel(props: NodeOutputVariablesPanelProps) {
  const fields = "node" in props ? nodeOutputFields(props.node) : workflowNodeOutputFields(props.nodeType);
  if (fields.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Output Variables</h3>
      <div className="space-y-3 rounded-md border border-border bg-card p-3">
        {fields.map((field) => (
          <OutputField key={field.name} field={field} />
        ))}
      </div>
    </section>
  );
}

function OutputField({ field, depth = 0 }: { field: WorkflowNodeOutputField; depth?: number }) {
  return (
    <div className={depth > 0 ? "border-l border-border pl-3" : ""}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <code className="break-all text-sm font-semibold text-foreground">{field.name}</code>
        <span className="text-xs font-semibold text-muted-foreground">{field.type}</span>
      </div>
      {field.description && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{field.description}</p>}
      {field.children && (
        <div className="mt-2 space-y-2">
          {field.children.map((child) => (
            <OutputField key={child.name} field={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
