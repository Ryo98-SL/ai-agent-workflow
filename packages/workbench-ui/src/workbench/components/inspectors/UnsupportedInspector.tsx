import { useTranslation } from "@ai-agent-workflow/i18n";
import type { WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";

type UnsupportedInspectorProps = {
  node: WorkflowNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

export function UnsupportedInspector({ node }: UnsupportedInspectorProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  return (
    <div className="space-y-4">
      <p className="rounded-md bg-muted p-3 text-sm leading-5 text-muted-foreground">
        {t("inspectors.unsupported.message", {
          defaultValue:
            "This {{type}} node type is part of the durable workflow schema, but real execution is deferred beyond the MVP.",
          type: node.type,
        })}
      </p>
    </div>
  );
}
