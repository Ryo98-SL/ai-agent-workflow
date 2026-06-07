import { CheckCircle2, History, Loader2, Trash2, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { WorkflowRun } from "@ai-agent-workflow/api-contracts";
import type { WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { useSession } from "../../data/useAccount";
import { useActiveWorkflowApi } from "../../data/useActiveWorkflowApi";
import { useDeleteWorkflowRun, useWorkflowRuns } from "../../data/useWorkflows";
import type { DebugState, NodeExecutionState } from "../types";
import { formatWorkbenchDate } from "../dateFormat";
import { Button } from "./Button";
import { DebugPanel } from "./DebugPanel";

type RunHistoryMenuProps = {
  workflow: WorkflowFile;
  workflowId?: string;
  debugState: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
};

function runDuration(run: WorkflowRun): string {
  if (!run.startedAt || !run.completedAt) return "In progress";
  const durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  if (durationMs < 1000) return "<1s";
  return `${Math.round(durationMs / 1000)}s`;
}

function StatusIcon({ status }: { status: WorkflowRun["status"] }) {
  if (status === "succeeded") return <CheckCircle2 size={15} className="text-brand" aria-hidden />;
  if (status === "failed") return <XCircle size={15} className="text-destructive" aria-hidden />;
  return <Loader2 size={15} className="animate-spin text-muted-foreground" aria-hidden />;
}

const EMPTY_HISTORY_STATE: DebugState = { status: "idle" };

export function RunHistoryMenu({ workflow, workflowId, debugState, nodeStates }: RunHistoryMenuProps) {
  const [open, setOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [historyDebugState, setHistoryDebugState] = useState<DebugState>(EMPTY_HISTORY_STATE);
  const [confirmingRunId, setConfirmingRunId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { data: session } = useSession();
  const workflowApi = useActiveWorkflowApi();
  const isAuthed = Boolean(session?.user);
  const { data, isLoading } = useWorkflowRuns(open ? workflowId : undefined);
  const deleteRun = useDeleteWorkflowRun(workflowId);
  const runs = useMemo(() => data?.runs ?? [], [data?.runs]);
  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId), [runs, selectedRunId]);
  const displayedDebugState = selectedRunId ? historyDebugState : debugState;
  const displayedNodeStates = selectedRunId ? new Map<string, NodeExecutionState>() : nodeStates;

  useEffect(() => {
    if (!open) {
      setSelectedRunId(null);
      setHistoryDebugState(EMPTY_HISTORY_STATE);
      setConfirmingRunId(null);
      setDeleteError(null);
      return;
    }

    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0].id);
    }
  }, [open, runs, selectedRunId]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || !selectedRunId) return;

    let cancelled = false;
    setHistoryDebugState({ status: "loading" });
    workflowApi
      .getRun(selectedRunId)
      .then(async (runResponse) => {
        const eventsResponse = await workflowApi.listRunEvents(selectedRunId);
        if (cancelled) return;
        setHistoryDebugState({
          status: runResponse.run.status === "failed" ? "error" : "success",
          result: { run: runResponse.run, events: eventsResponse.events },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setHistoryDebugState({
          status: "error",
          error: error instanceof Error ? error.message : "Run history failed to load.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedRunId, workflowApi]);

  const closeDrawer = () => setOpen(false);

  const confirmDeleteRun = async (runId: string) => {
    setDeleteError(null);
    try {
      await deleteRun.mutateAsync(runId);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Run deletion failed.");
      return;
    }

    setConfirmingRunId(null);
    if (selectedRunId === runId) {
      const nextRun = runs.find((run) => run.id !== runId);
      setSelectedRunId(nextRun?.id ?? null);
      if (!nextRun) {
        setHistoryDebugState(EMPTY_HISTORY_STATE);
      }
    }
  };

  const drawer =
    open && typeof document !== "undefined" ? (
      <div className="fixed inset-0 z-[200] p-3 max-sm:p-2">
        <button
          type="button"
          className="absolute inset-0 cursor-default bg-black/30"
          aria-label="Close run history"
          onClick={closeDrawer}
        />
        <aside
          aria-label="Run history drawer"
          className="relative ml-auto flex h-full w-[50vw] min-w-[640px] max-w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl shadow-black/30 max-md:min-w-[520px] max-sm:w-full max-sm:min-w-0"
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">Run history</h2>
              <p className="truncate text-xs text-muted-foreground">
                {selectedRun ? `Historical run from ${formatWorkbenchDate(selectedRun.createdAt)}` : "Current run output"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={closeDrawer}
              aria-label="Close run history"
              title="Close run history"
            >
              <X size={16} aria-hidden />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 gap-3 bg-muted/20 p-3">
            <section className="min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-card">
              <DebugPanel
                workflow={workflow}
                debugState={displayedDebugState}
                nodeStates={displayedNodeStates}
                onRun={() => undefined}
                readOnly
              />
            </section>

            <section className="flex w-[260px] shrink-0 flex-col overflow-hidden rounded-md border border-border bg-card max-sm:w-[230px]">
              <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Runs
              </div>

              {!workflowId ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Run this workflow to see its history.
                </p>
              ) : isLoading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <Loader2 size={15} className="animate-spin" aria-hidden /> Loading…
                </div>
              ) : runs.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No runs yet.</p>
              ) : (
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
                  {runs.map((run) => {
                    const date = formatWorkbenchDate(run.createdAt);
                    const selected = run.id === selectedRunId;

                    if (confirmingRunId === run.id) {
                      return (
                        <div key={run.id} className="flex h-14 items-center gap-2 rounded-md bg-accent px-2">
                          <span className="min-w-0 flex-1 text-sm text-muted-foreground">Delete this run?</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleteRun.isPending}
                            onClick={() => {
                              void confirmDeleteRun(run.id);
                            }}
                          >
                            Delete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleteRun.isPending}
                            onClick={() => {
                              setConfirmingRunId(null);
                              setDeleteError(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <div key={run.id} className="group/run flex h-14 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="unstyled"
                          className={[
                            "h-full min-w-0 flex-1 justify-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent",
                            selected ? "bg-accent text-accent-foreground" : "",
                          ].join(" ")}
                          aria-label={`Open run from ${date}`}
                          onClick={() => {
                            setSelectedRunId(run.id);
                            setConfirmingRunId(null);
                            setDeleteError(null);
                          }}
                        >
                          <StatusIcon status={run.status} />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate font-medium text-foreground">{date}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{runDuration(run)}</span>
                          </span>
                        </Button>
                        <Button
                          variant="dangerGhost"
                          size="iconSm"
                          aria-label={`Delete run from ${date}`}
                          title="Delete run"
                          className="opacity-0 group-hover/run:opacity-100 focus-visible:opacity-100"
                          onClick={() => setConfirmingRunId(run.id)}
                        >
                          <Trash2 size={14} aria-hidden />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {!isAuthed && workflowId && (
                <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                  Runs are kept for this session only. Sign in to save your history.
                </p>
              )}
              {deleteError && (
                <p className="border-t border-border px-3 py-2 text-[11px] text-destructive">{deleteError}</p>
              )}
            </section>
          </div>
        </aside>
      </div>
    ) : null;

  return (
    <>
      <Button
        variant="secondary"
        size="iconMd"
        aria-label="Run history"
        title="Run history"
        onClick={() => setOpen((v) => !v)}
      >
        <History size={16} aria-hidden />
      </Button>
      {drawer ? createPortal(drawer, document.body) : null}
    </>
  );
}
