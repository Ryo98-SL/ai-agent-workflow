import { GitBranch } from "lucide-react";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function IfElseWorkflowNode(props: WorkflowNodeProps) {
  return <WorkflowNodeCardShell {...props} Icon={GitBranch} />;
}
