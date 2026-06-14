import { CheckCircle2, History, Loader2, PauseCircle, Trash2, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  RunSseEventSchema,
  type RunEvent,
  type ResumeRunRequest,
  type WorkflowRun,
} from "@ai-agent-workflow/api-contracts";
import type { WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { useSession } from "../../data/useAccount";
import { useActiveWorkflowApi } from "../../data/useActiveWorkflowApi";
import { useDeleteWorkflowRun, useWorkflowRuns } from "../../data/useWorkflows";
import type { DebugState, NodeExecutionState } from "../types";
import { formatWorkbenchDate } from "../dateFormat";
import { reduceRunNodeStreamEvent } from "../runStreamReducer";
import { Button } from "./Button";
import { DebugPanel } from "./DebugPanel";
import { createNodeExecutionStateFromRunResult } from "./runHistoryState";

type RunHistoryMenuProps = {
  workflow: WorkflowFile;
  workflowId?: string;
  debugState: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
};

function runDuration(run: WorkflowRun): string {
  if (run.status === "waiting_human") return "Waiting";
  if (!run.startedAt || !run.completedAt) return "In progress";
  const durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  if (durationMs < 1000) return "<1s";
  return `${Math.round(durationMs / 1000)}s`;
}

function StatusIcon({ status }: { status: WorkflowRun["status"] }) {
  if (status === "succeeded") return <CheckCircle2 size={15} className="text-brand" aria-hidden />;
  if (status === "failed") return <XCircle size={15} className="text-destructive" aria-hidden />;
  if (status === "waiting_human") return <PauseCircle size={15} className="text-amber-500" aria-hidden />;
  return <Loader2 size={15} className="animate-spin text-muted-foreground" aria-hidden />;
}

const EMPTY_HISTORY_STATE: DebugState = { status: "idle" };

/**
 * Derives node-execution states for a run's already-finished nodes. Seeds the
 * resume stream so the legs that ran before the pause stay rendered while the
 * post-interrupt nodes stream in (LangGraph resumes from the checkpoint, so prior
 * nodes never re-emit events). The paused node and the nodes after it arrive via
 * the stream's `node.started`/`node.completed` events.
 */
function nodeStatesFromRun(workflow: WorkflowFile, run: WorkflowRun, events: RunEvent[]): Map<string, NodeExecutionState> {
  const nodesById = new Map(workflow.graph.nodes.map((node) => [node.id, node] as const));
  const states = new Map<string, NodeExecutionState>();
  for (const result of run.output?.nodeResults ?? []) {
    const node = nodesById.get(result.nodeId);
    if (!node) continue;
    states.set(result.nodeId, createNodeExecutionStateFromRunResult({ events, node, nodeResult: result, run }));
  }
  return states;
}

export function RunHistoryMenu({ workflow, workflowId, debugState, nodeStates }: RunHistoryMenuProps) {
  const [open, setOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [historyDebugState, setHistoryDebugState] = useState<DebugState>(EMPTY_HISTORY_STATE);
  const [confirmingRunId, setConfirmingRunId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [resumeSubmitting, setResumeSubmitting] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  // Live node states while a resumed run streams; null when not resuming (the
  // panel then derives cards from the fetched run result instead).
  const [resumeNodeStates, setResumeNodeStates] = useState<Map<string, NodeExecutionState> | null>(null);
  const resumeStreamRef = useRef<EventSource | null>(null);
  const { data: session } = useSession();
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  const isAuthed = Boolean(session?.user);
  const { data, isLoading } = useWorkflowRuns(open ? workflowId : undefined);
  const deleteRun = useDeleteWorkflowRun(workflowId);
  const runs = useMemo(() => data?.runs ?? [], [data?.runs]);
  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId), [runs, selectedRunId]);
  const displayedDebugState = selectedRunId ? historyDebugState : debugState;
  // While a resumed run streams, drive the cards from its live node states;
  // otherwise the panel derives them from the fetched run result.
  const displayedNodeStates = selectedRunId
    ? resumeNodeStates ?? new Map<string, NodeExecutionState>()
    : nodeStates;

  // Tears down any in-flight resume stream and clears its live node states.
  const closeResumeStream = useCallback(() => {
    if (resumeStreamRef.current) {
      resumeStreamRef.current.close();
      resumeStreamRef.current = null;
    }
    setResumeNodeStates(null);
    setResumeSubmitting(false);
  }, []);

  // Close the stream when the component unmounts.
  useEffect(() => closeResumeStream, [closeResumeStream]);

  useEffect(() => {
    if (!open) {
      setSelectedRunId(null);
      setHistoryDebugState(EMPTY_HISTORY_STATE);
      setConfirmingRunId(null);
      setDeleteError(null);
      setResumeError(null);
      closeResumeStream();
      return;
    }

    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0].id);
    }
  }, [open, runs, selectedRunId, closeResumeStream]);

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
    setResumeError(null);
    // Switching runs abandons any resume stream tied to the previous selection.
    closeResumeStream();
    workflowApi
      .getRun(selectedRunId)
      .then(async (runResponse) => {
        const eventsResponse = await workflowApi.listRunEvents(selectedRunId);
        if (cancelled) return;
        const run = runResponse.run;
        const result = { run, events: eventsResponse.events };
        if (run.status === "waiting_human" && run.interrupt) {
          // Keep the panel header consistent with the list's "Waiting" status.
          setHistoryDebugState({ status: "waiting", waiting: { runId: run.id, interrupt: run.interrupt }, result });
        } else {
          setHistoryDebugState({ status: run.status === "failed" ? "error" : "success", result });
        }
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
  }, [open, selectedRunId, workflowApi, closeResumeStream]);

  const closeDrawer = () => setOpen(false);

  // Once a resumed leg ends (completed/failed, or paused again on another Human
  // Input node), re-fetch the canonical run + events so every node card and the
  // runs-list status reflect the final state, then drop the live stream states.
  const refreshAfterResume = useCallback(
    (runId: string) => {
      Promise.all([workflowApi.getRun(runId), workflowApi.listRunEvents(runId)])
        .then(([runResponse, eventsResponse]) => {
          const run = runResponse.run;
          const result = { run, events: eventsResponse.events };
          if (run.status === "waiting_human" && run.interrupt) {
            setHistoryDebugState({ status: "waiting", waiting: { runId: run.id, interrupt: run.interrupt }, result });
          } else {
            setHistoryDebugState({ status: run.status === "failed" ? "error" : "success", result });
          }
          setResumeNodeStates(null);
          setResumeSubmitting(false);
          if (workflowId) {
            void queryClient.invalidateQueries({ queryKey: ["workflow-runs", workflowId] });
          }
        })
        .catch((error: unknown) => {
          setResumeNodeStates(null);
          setResumeSubmitting(false);
          setResumeError(error instanceof Error ? error.message : "Run refresh failed.");
        });
    },
    [queryClient, workflowApi, workflowId],
  );

  // Subscribe to the resumed run's SSE stream (same pipeline as a live run): node
  // events update the live cards; a run-level event ends the leg and triggers a
  // canonical refresh. Prior nodes are seeded by the caller.
  const subscribeResumeStream = useCallback(
    (runId: string) => {
      const source = new EventSource(workflowApi.runStreamUrl(runId));
      resumeStreamRef.current = source;

      source.onmessage = (msgEvent) => {
        const parsed = RunSseEventSchema.safeParse(JSON.parse(String(msgEvent.data)));
        if (!parsed.success) return;
        const sseEvent = parsed.data;

        if (
          sseEvent.type === "node.started" ||
          sseEvent.type === "node.stream" ||
          sseEvent.type === "node.completed" ||
          sseEvent.type === "node.failed"
        ) {
          setResumeNodeStates((prev) => reduceRunNodeStreamEvent(prev ?? new Map(), sseEvent));
        } else if (sseEvent.type === "run.completed" || sseEvent.type === "run.waiting") {
          source.close();
          resumeStreamRef.current = null;
          refreshAfterResume(runId);
        }
      };

      source.onerror = () => {
        // The stream closes cleanly after a run-level event; only a drop while the
        // ref is still ours is a genuine failure.
        if (resumeStreamRef.current !== source) return;
        source.close();
        resumeStreamRef.current = null;
        setResumeNodeStates(null);
        setResumeSubmitting(false);
        setResumeError("连接中断，请重试。");
      };
    },
    [refreshAfterResume, workflowApi],
  );

  // Resume a paused (waiting_human) run straight from history. The HTTP response
  // returns immediately with the run set to "running" while the continuation runs
  // asynchronously, so we seed the prior nodes, switch to a running view, and
  // stream the rest in rather than capturing the stale snapshot.
  const resumeHistoryRun = useCallback(
    (runId: string, request: ResumeRunRequest) => {
      closeResumeStream();
      setResumeSubmitting(true);
      setResumeError(null);
      workflowApi
        .resumeRun(runId, request)
        .then(({ run }) => {
          // The resumed run still carries the pre-pause nodeResults; seed them so
          // the finished legs stay visible while the rest streams in.
          setResumeNodeStates(nodeStatesFromRun(workflow, run, []));
          setHistoryDebugState({ status: "running", result: { run, events: [] } });
          subscribeResumeStream(runId);
        })
        .catch((error: unknown) => {
          // Keep the waiting state so the form stays available to retry.
          setResumeSubmitting(false);
          setResumeError(error instanceof Error ? error.message : "Resume failed.");
        });
    },
    [closeResumeStream, subscribeResumeStream, workflow, workflowApi],
  );

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
                onResumeRun={resumeHistoryRun}
                resumeSubmitting={resumeSubmitting}
                resumeError={resumeError ?? undefined}
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
