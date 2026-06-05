import { Save } from "lucide-react";
import { Button } from "./Button";

type ProjectFileActionsProps = {
  dirty: boolean;
  filePath?: string;
  onSave: () => void;
};

// New / Open / Save-as live in the workflow switcher now; only Save remains here.
export function ProjectFileActions({ dirty, filePath, onSave }: ProjectFileActionsProps) {
  return (
    <Button
      variant="primary"
      size="md"
      onClick={onSave}
      disabled={!dirty && Boolean(filePath)}
      title="Save workflow"
    >
      <Save size={16} aria-hidden />
      Save
    </Button>
  );
}
