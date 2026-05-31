import { FileDown, FilePlus2, FolderOpen, Save } from "lucide-react";
import type { ReactNode } from "react";

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
      <IconButton label="New workflow" onClick={onNew}>
        <FilePlus2 size={16} />
      </IconButton>
      <IconButton label="Open workflow" onClick={onOpen}>
        <FolderOpen size={16} />
      </IconButton>
      <button
        type="button"
        onClick={onSave}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={!dirty && Boolean(filePath)}
        title="Save workflow"
      >
        <Save size={16} aria-hidden />
        Save
      </button>
      <IconButton label="Save workflow as" onClick={onSaveAs}>
        <FileDown size={16} />
      </IconButton>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100"
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}
