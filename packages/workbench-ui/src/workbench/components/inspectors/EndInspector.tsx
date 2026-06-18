import type { ReactNode } from "react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import type { EndNode, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import { VariableRichTextEditor } from "../richtext/VariableRichTextEditor";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";

type EndInspectorProps = {
  node: EndNode;
  updateNode: (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => void;
};

/**
 * End node inspector. Authors the node's Answer Template (`config.answer`) — the
 * free-form rich text, interleaved with `/`-inserted Variable References, that the
 * runtime resolves into this node's final output when a run reaches it.
 */
export function EndInspector({ node, updateNode }: EndInspectorProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const updateConfig = (patch: Partial<EndNode["config"]>) => {
    updateNode(node.id, (current) =>
      current.type === "end" ? { ...current, config: { ...current.config, ...patch } } : current,
    );
  };

  return (
    <div className="space-y-4">
      <Field label={t("inspectors.common.answer", { defaultValue: "Answer" })}>
        <VariableRichTextEditor
          nodeId={node.id}
          ariaLabel={t("inspectors.common.answer", { defaultValue: "Answer" })}
          value={node.config.answer ?? ""}
          onChange={(answer) => updateConfig({ answer })}
          placeholder={t("inspectors.end.answerPlaceholder", {
            defaultValue: "Enter the workflow output, type / to reference variables",
          })}
          className="min-h-24"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
