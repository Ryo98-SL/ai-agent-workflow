import { Save } from "lucide-react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { WORKBENCH_I18N_NAMESPACE } from "../../i18n";
import { Button } from "./Button";

type ProjectFileActionsProps = {
  dirty: boolean;
  filePath?: string;
  onSave: () => void;
};

// New / Open / Save-as live in the workflow switcher now; only Save remains here.
export function ProjectFileActions({ dirty, filePath, onSave }: ProjectFileActionsProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);

  return (
    <Button
      variant="primary"
      size="md"
      onClick={onSave}
      disabled={!dirty && Boolean(filePath)}
      title={t("projectFileActions.saveWorkflow")}
    >
      <Save size={16} aria-hidden />
      {t("projectFileActions.save")}
    </Button>
  );
}
