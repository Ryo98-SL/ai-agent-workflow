import { Braces } from "lucide-react";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function CodeWorkflowNode(props: WorkflowNodeProps) {
  return <WorkflowNodeCardShell {...props} Icon={Braces} />;
}
