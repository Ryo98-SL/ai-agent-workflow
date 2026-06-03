import { Flag } from "lucide-react";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function EndWorkflowNode(props: WorkflowNodeProps) {
  return <WorkflowNodeCardShell {...props} noSourceHandle Icon={Flag} />;
}
