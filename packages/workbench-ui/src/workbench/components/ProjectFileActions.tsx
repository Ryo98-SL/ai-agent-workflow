import { Loader2, Save } from "lucide-react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { WORKBENCH_I18N_NAMESPACE } from "../../i18n";
import { Button } from "./Button";

type ProjectFileActionsProps = {
  dirty: boolean;
  filePath?: string;
  saving: boolean;
  onSave: () => void;
};

// New / Open / Save-as live in the workflow switcher now; only Save remains here.
export function ProjectFileActions({ dirty, filePath, saving, onSave }: ProjectFileActionsProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);

  return (
    <Button
      variant="primary"
      size="md"
      onClick={onSave}
      disabled={saving || (!dirty && Boolean(filePath))}
      title={t("projectFileActions.saveWorkflow")}
    >
      {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
      {saving ? t("projectFileActions.saving") : t("projectFileActions.save")}
    </Button>
  );
}
