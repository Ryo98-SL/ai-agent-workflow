import { Database } from "lucide-react";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function KnowledgeWorkflowNode(props: WorkflowNodeProps) {
  return <WorkflowNodeCardShell {...props} Icon={Database} />;
}
