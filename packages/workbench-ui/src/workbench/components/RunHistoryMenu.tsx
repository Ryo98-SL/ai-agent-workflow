import { CheckCircle2, History, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import type { WorkflowRun } from "@ai-agent-workflow/api-contracts";
import { useSession } from "../../data/useAccount";
import { useWorkflowRuns } from "../../data/useWorkflows";
import { Button } from "./Button";
import { Popover } from "./Popover";

type RunHistoryMenuProps = {
  workflowId?: string;
  onOpenRun: (runId: string) => void;
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function StatusIcon({ status }: { status: WorkflowRun["status"] }) {
  if (status === "succeeded") return <CheckCircle2 size={15} className="text-brand" aria-hidden />;
  if (status === "failed") return <XCircle size={15} className="text-destructive" aria-hidden />;
  return <Loader2 size={15} className="animate-spin text-muted-foreground" aria-hidden />;
}

export function RunHistoryMenu({ workflowId, onOpenRun }: RunHistoryMenuProps) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const isAuthed = Boolean(session?.user);
  const { data, isLoading } = useWorkflowRuns(open ? workflowId : undefined);
  const runs = data?.runs ?? [];

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      renderTrigger={({ ref, props }) => (
        <Button
          {...props}
          ref={ref}
          variant="secondary"
          size="iconMd"
          aria-label="Run history"
          title="Run history"
          onClick={() => setOpen((v) => !v)}
        >
          <History size={16} aria-hidden />
        </Button>
      )}
    >
      <div className="w-[320px] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
        <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Run history
        </div>

        {!workflowId ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Run this workflow to see its history.</p>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" aria-hidden /> Loading…
          </div>
        ) : runs.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto py-1">
            {runs.map((run) => (
              <Button
                key={run.id}
                variant="ghost"
                size="unstyled"
                fullWidth
                className="justify-start gap-2 rounded-none px-3 py-2 text-sm hover:bg-accent"
                onClick={() => {
                  onOpenRun(run.id);
                  setOpen(false);
                }}
              >
                <StatusIcon status={run.status} />
                <span className="min-w-0 flex-1 truncate text-left capitalize">{run.status}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(run.createdAt)}</span>
              </Button>
            ))}
          </div>
        )}

        {!isAuthed && workflowId && (
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            Runs are kept for this session only — sign in to save your history.
          </p>
        )}
      </div>
    </Popover>
  );
}
