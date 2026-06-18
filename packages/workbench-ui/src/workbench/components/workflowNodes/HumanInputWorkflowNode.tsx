import { UserCheck } from "lucide-react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";
import { VariableText } from "../VariableTag";
import { WorkflowNodeCardShell, type WorkflowNodeProps } from "./WorkflowNodeCardShell";

export function HumanInputWorkflowNode(props: WorkflowNodeProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const node = props.data.node;
  return (
    <WorkflowNodeCardShell {...props} Icon={UserCheck}>
      {node.type === "humanInput" ? (
        <div className="mt-1 space-y-1.5">
          <p className="text-xs leading-5 text-muted-foreground">
            <VariableText
              text={
                node.config.prompt?.trim() ||
                t("workflowNodes.pauseForHumanDecision", { defaultValue: "Pause for a human decision." })
              }
            />
          </p>
          <div className="flex flex-wrap gap-1">
            {node.config.actions.map((action) => (
              <span key={action.id} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                {action.label}
              </span>
            ))}
            {node.config.allowTextInput && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] italic text-muted-foreground">
                {t("workflowNodes.textReply", { defaultValue: "+ text" })}
              </span>
            )}
          </div>
        </div>
      ) : null}
    </WorkflowNodeCardShell>
  );
}
