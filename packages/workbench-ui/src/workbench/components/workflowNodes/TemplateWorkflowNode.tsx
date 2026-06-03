import { TextCursorInput } from "lucide-react";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function TemplateWorkflowNode(props: WorkflowNodeProps) {
  return <WorkflowNodeCardShell {...props} Icon={TextCursorInput} />;
}
