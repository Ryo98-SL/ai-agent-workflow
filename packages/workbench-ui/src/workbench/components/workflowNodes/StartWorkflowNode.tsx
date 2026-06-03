import { Play } from "lucide-react";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function StartWorkflowNode(props: WorkflowNodeProps) {
  const node = props.data.node;
  const fields = node.type === "start" ? node.config.fields : [];

  return (
    <WorkflowNodeCardShell {...props} noTargetHandle Icon={Play}>
      <div className="mt-3 space-y-2">
        {fields.length === 0 ? (
          <div className="flex min-h-8 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-500">
            No input fields
          </div>
        ) : (
          <div className="space-y-1.5">
            {fields.map((field) => (
              <div key={field.name} className="flex min-h-8 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2">
                <span className="shrink-0 text-sm font-semibold text-blue-600">{"{x}"}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{field.name}</span>
                {field.required && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Required</span>
                )}
              </div>
            ))}
          </div>
        )}
        {node.description && <p className="text-xs text-slate-500">{node.description}</p>}
      </div>
    </WorkflowNodeCardShell>
  );
}
