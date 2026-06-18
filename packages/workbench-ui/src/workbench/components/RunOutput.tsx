import { AlertTriangle, CheckCircle2, Loader2, UserCheck } from "lucide-react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import type { ResumeRunRequest } from "@ai-agent-workflow/api-contracts";
import type { WorkflowFile, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import { WORKBENCH_I18N_NAMESPACE } from "../../i18n";
import type { DebugState, NodeExecutionState } from "../types";
import { RunNodeCardList, RunWaitingNodeCard } from "./RunNodeCard";
import { RunEmptyState, RunErrorBox } from "./RunOutputPrimitives";
import { createNodeExecutionStateFromRunResult } from "./runHistoryState";

type RunOutputProps = {
  workflow: WorkflowFile;
  debugState: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
  nodeId?: string;
  /**
   * When provided alongside a `waiting` run, the paused Human Input node gets a
   * synthesized card (after the completed ones) hosting the reviewer form.
   * Opt-in: callers that render their own HITL UI (e.g. ChatPanel's trace) omit
   * this so the card is not duplicated.
   */
  onResumeRun?: (runId: string, request: ResumeRunRequest) => void;
  resumeSubmitting?: boolean;
  resumeError?: string;
};

export function RunOutput({
  workflow,
  debugState,
  nodeStates,
  nodeId,
  onResumeRun,
  resumeSubmitting,
  resumeError,
}: RunOutputProps) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const resolvedNodeStates = nodeStates.size > 0 ? nodeStates : nodeStatesFromRun(workflow, debugState);
  const hasWorkflowRun = resolvedNodeStates.size > 0 || Boolean(debugState.result);
  const visibleNodeStates = nodeId ? filterNodeStates(resolvedNodeStates, nodeId) : resolvedNodeStates;
  const hasVisibleNodeRun = visibleNodeStates.size > 0;
  // The paused Human Input node renders as its own card (full view only); the
  // per-node filtered view drives its own HITL UI from the node inspector.
  const waiting =
    !nodeId && debugState.status === "waiting" && debugState.waiting && onResumeRun ? debugState.waiting : undefined;
  const waitingNode = waiting
    ? workflow.graph.nodes.find((node) => node.id === waiting.interrupt.nodeId)
    : undefined;

  if (debugState.status === "idle" && !hasWorkflowRun) {
    return (
      <RunEmptyState
        title={t("runOutput.readyTitle", { defaultValue: "Ready to run" })}
        detail={t("runOutput.readyDetail", { defaultValue: "Run the workflow to inspect server output and events." })}
      />
    );
  }

  if (debugState.status === "loading") {
    return (
      <RunEmptyState
        title={t("runOutput.loadingTitle", { defaultValue: "Loading" })}
        detail={t("runOutput.loadingWorkflowDetail", {
          defaultValue: "The workbench is syncing workflow state with the server API.",
        })}
        loading
      />
    );
  }

  if (debugState.status === "running" && !hasWorkflowRun) {
    return (
      <div className="space-y-3">
        <RunStatusHeader debugState={debugState} />
        <RunEmptyState
          title={t("runOutput.runningTitle", { defaultValue: "Running" })}
          detail={t("runOutput.waitingFirstNodeDetail", { defaultValue: "Waiting for the first node to start..." })}
          loading
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {debugState.error && <RunErrorBox message={debugState.error} />}
      {hasWorkflowRun && <RunStatusHeader debugState={debugState} />}
      {debugState.status === "running" && !hasVisibleNodeRun ? (
        <RunEmptyState
          title={t("runOutput.runningTitle", { defaultValue: "Running" })}
          detail={
            nodeId
              ? t("runOutput.waitingThisNodeDetail", { defaultValue: "Waiting for this node to start..." })
              : t("runOutput.waitingFirstNodeDetail", { defaultValue: "Waiting for the first node to start..." })
          }
          loading
        />
      ) : hasVisibleNodeRun ? (
        <RunNodeCardList workflow={workflow} nodeStates={visibleNodeStates} debugState={debugState} />
      ) : !waiting ? (
        <RunEmptyState
          title={
            nodeId
              ? t("runOutput.noNodeOutputTitle", { defaultValue: "No node output" })
              : t("runOutput.noRunOutputTitle", { defaultValue: "No run output" })
          }
          detail={
            nodeId
              ? t("runOutput.noNodeOutputDetail", { defaultValue: "The latest run has no recorded output for this node." })
              : t("runOutput.noRunOutputDetail", { defaultValue: "Run the workflow to inspect node output." })
          }
        />
      ) : null}
      {waiting && onResumeRun && (
        <RunWaitingNodeCard
          label={waitingNode?.label ?? waiting.interrupt.nodeId}
          node={waitingNode}
          runId={waiting.runId}
          interrupt={waiting.interrupt}
          submitting={resumeSubmitting}
          resumeError={resumeError}
          onResumeRun={onResumeRun}
        />
      )}
    </div>
  );
}

function filterNodeStates(nodeStates: Map<string, NodeExecutionState>, nodeId: string) {
  const state = nodeStates.get(nodeId);
  return state ? new Map([[nodeId, state]]) : new Map<string, NodeExecutionState>();
}

function nodeStatesFromRun(workflow: WorkflowFile, debugState: DebugState) {
  const run = debugState.result?.run;
  if (!run?.output) {
    return new Map<string, NodeExecutionState>();
  }

  const nodesById = new Map(workflow.graph.nodes.map((node) => [node.id, node] as const));
  const states = new Map<string, NodeExecutionState>();
  for (const result of run.output.nodeResults) {
    const node = nodesById.get(result.nodeId) ?? fallbackWorkflowNode(result.nodeId);
    states.set(
      result.nodeId,
      createNodeExecutionStateFromRunResult({
        events: debugState.result?.events ?? [],
        node,
        nodeResult: result,
        run,
      }),
    );
  }
  return states;
}

function fallbackWorkflowNode(nodeId: string): WorkflowNode {
  return {
    id: nodeId,
    type: "code",
    label: nodeId,
    description: undefined,
    position: { x: 0, y: 0 },
    config: {},
  };
}

function RunStatusHeader({ debugState }: { debugState: DebugState }) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const run = debugState.result?.run;

  if (debugState.status === "running") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-brand/30 bg-brand/10 px-3 py-2">
        <Loader2 size={16} className="shrink-0 animate-spin text-brand" aria-hidden />
        <span className="text-sm font-semibold text-brand">
          {t("runOutput.runningWorkflow", { defaultValue: "Running workflow..." })}
        </span>
      </div>
    );
  }

  if (debugState.status === "waiting") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
        <UserCheck size={16} className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          {t("runOutput.awaitingHumanReview", { defaultValue: "Awaiting human review..." })}
        </span>
      </div>
    );
  }

  if (run) {
    const failed = run.status === "failed";
    return (
      <div
        className={[
          "flex items-center gap-2 rounded-md border px-3 py-2",
          failed ? "border-destructive/30 bg-destructive/10" : "border-brand/30 bg-brand/10",
        ].join(" ")}
      >
        {failed ? (
          <AlertTriangle size={16} className="shrink-0 text-destructive" aria-hidden />
        ) : (
          <CheckCircle2 size={16} className="shrink-0 text-brand" aria-hidden />
        )}
        <span className={["text-sm font-semibold", failed ? "text-destructive" : "text-brand"].join(" ")}>
          {failed
            ? t("runOutput.runFailed", { defaultValue: "Run failed" })
            : t("runOutput.runSucceeded", { defaultValue: "Run succeeded" })}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
      <CheckCircle2 size={16} className="shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-sm font-semibold text-muted-foreground">
        {t("runOutput.runComplete", { defaultValue: "Run complete" })}
      </span>
    </div>
  );
}
