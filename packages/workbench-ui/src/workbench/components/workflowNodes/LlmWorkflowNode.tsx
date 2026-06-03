import { Brain } from "lucide-react";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function LlmWorkflowNode(props: WorkflowNodeProps) {
  const {node} = props.data;
  return <WorkflowNodeCardShell {...props} Icon={Brain}>
    <div className="mt-3 space-y-2">
      {
          node.description &&
          <p className="text-xs text-slate-500">{node.description}</p>
      }
    </div>
  </WorkflowNodeCardShell>;
}
