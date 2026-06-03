import { Clock } from "lucide-react";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function ToolWorkflowNode(props: WorkflowNodeProps) {
  return <WorkflowNodeCardShell {...props} Icon={Clock} />;
}
