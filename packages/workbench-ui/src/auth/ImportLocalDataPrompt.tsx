import { WorkflowFileSchema } from "@ai-agent-workflow/workflow-domain";
import { Loader2, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { Button } from "../workbench/components/Button";
import { useWorkbenchData } from "../data/WorkbenchDataProvider";
import { useSession } from "../data/useAccount";
import { deleteLocalWorkflow, readLocalWorkflows } from "../data/localWorkflowStore";

type Phase = "idle" | "importing" | "done" | "error";

/**
 * On first sign-in, offers to import workflows created while anonymous (stored
 * in IndexedDB) into the account. API keys are intentionally not imported —
 * the user re-enters them so they get encrypted server-side. Custom models ride
 * along inside their workflows.
 */
export function ImportLocalDataPrompt() {
  const { t } = useTranslation("workbench");
  const { data } = useSession();
  const { workflowApi, requestWorkflowRefresh } = useWorkbenchData();
  const isAuthed = Boolean(data?.user);

  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  // Snapshot local workflows once the user is authenticated.
  useEffect(() => {
    if (!isAuthed) {
      setCount(0);
      setDismissed(false);
      setPhase("idle");
      return;
    }
    let cancelled = false;
    void readLocalWorkflows().then((records) => {
      if (!cancelled) {
        setCount(records.length);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  if (!isAuthed || count === 0 || dismissed) {
    return null;
  }

  const runImport = async () => {
    setPhase("importing");
    setError(null);

    // Import each record independently: drop schema-invalid junk, delete each
    // success so a retry resumes instead of restarting, keep genuine failures.
    let imported = 0;
    let kept = 0;
    for (const record of await readLocalWorkflows()) {
      if (!WorkflowFileSchema.safeParse(record.workflow).success) {
        await deleteLocalWorkflow(record.id); // discard unusable record
        continue;
      }
      try {
        await workflowApi.createWorkflow({ workflow: record.workflow });
        await deleteLocalWorkflow(record.id);
        imported += 1;
      } catch {
        kept += 1;
      }
    }

    if (kept === 0) {
      setPhase("done");
      // Refresh the workbench list in place (no full page reload).
      requestWorkflowRefresh();
      setTimeout(() => {
        setCount(0);
        setDismissed(true);
      }, 1200);
      return;
    }

    setCount(kept);
    setPhase("error");
    setError(t("auth.import.partial", { imported, kept }));
  };

  return (
    <div className="absolute inset-x-0 top-2 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-xl items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <UploadCloud size={18} className="shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          {phase === "done" ? (
            <span className="text-foreground">{t("auth.import.done", { count })}</span>
          ) : (
            <>
              <p className="font-medium text-foreground">
                {t("auth.import.question", { count })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("auth.import.note")}
              </p>
              {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
            </>
          )}
        </div>
        {phase !== "done" && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="success" size="sm" disabled={phase === "importing"} onClick={runImport}>
              {phase === "importing" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : t("auth.import.import")}
            </Button>
            <Button
              variant="ghost"
              size="iconMd"
              aria-label={t("auth.import.dismiss")}
              disabled={phase === "importing"}
              onClick={() => setDismissed(true)}
            >
              <X size={15} aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
