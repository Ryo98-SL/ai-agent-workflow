import { FileDown, FilePlus2, FolderOpen, Save } from "lucide-react";
import { Button } from "./Button";

type ProjectFileActionsProps = {
  dirty: boolean;
  filePath?: string;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
};

export function ProjectFileActions({ dirty, filePath, onNew, onOpen, onSave, onSaveAs }: ProjectFileActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="iconMd" title="New workflow" aria-label="New workflow" onClick={onNew}>
        <FilePlus2 size={16} aria-hidden />
      </Button>
      <Button variant="secondary" size="iconMd" title="Open workflow" aria-label="Open workflow" onClick={onOpen}>
        <FolderOpen size={16} aria-hidden />
      </Button>
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
      <Button variant="secondary" size="iconMd" title="Save workflow as" aria-label="Save workflow as" onClick={onSaveAs}>
        <FileDown size={16} aria-hidden />
      </Button>
    </div>
  );
}
