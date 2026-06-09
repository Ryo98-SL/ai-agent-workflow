import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./Button";

type WorkflowSwitchBarProps = {
  targetName: string;
  busy: boolean;
  onSaveAndSwitch: () => void;
  onCancel: () => void;
};

/**
 * A floating, top-centered notification shown when the user tries to switch
 * workflows with unsaved changes. Offers "Save & switch" or "Cancel".
 */
export function WorkflowSwitchBar({ targetName, busy, onSaveAndSwitch, onCancel }: WorkflowSwitchBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-50 flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-lg border border-brand/30 bg-brand/10 px-4 py-2 text-sm shadow-xl shadow-black/20 backdrop-blur-md animate-in fade-in slide-in-from-top-2 md:max-w-2xl"
      >
        <AlertTriangle size={15} className="shrink-0 text-brand" aria-hidden />
        <span className="min-w-0 truncate text-foreground">
          Unsaved changes — save before switching to “{targetName}”?
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="success" size="sm" onClick={onSaveAndSwitch} disabled={busy}>
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Save &amp; switch
        </Button>
      </div>
    </div>
  );
}
