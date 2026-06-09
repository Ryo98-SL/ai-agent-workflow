import { AlertTriangle, CheckCircle2, Loader2, UserCheck } from "lucide-react";
import type { WorkflowFile, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import type { DebugState, NodeExecutionState } from "../types";
import { RunNodeCardList } from "./RunNodeCard";
import { RunEmptyState, RunErrorBox } from "./RunOutputPrimitives";
import { createNodeExecutionStateFromRunResult } from "./runHistoryState";

type RunOutputProps = {
  workflow: WorkflowFile;
  debugState: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
  nodeId?: string;
};

export function RunOutput({ workflow, debugState, nodeStates, nodeId }: RunOutputProps) {
  const resolvedNodeStates = nodeStates.size > 0 ? nodeStates : nodeStatesFromRun(workflow, debugState);
  const hasWorkflowRun = resolvedNodeStates.size > 0 || Boolean(debugState.result);
  const visibleNodeStates = nodeId ? filterNodeStates(resolvedNodeStates, nodeId) : resolvedNodeStates;
  const hasVisibleNodeRun = visibleNodeStates.size > 0;

  if (debugState.status === "idle" && !hasWorkflowRun) {
    return <RunEmptyState title="Ready to run" detail="Run the workflow to inspect server output and events." />;
  }

  if (debugState.status === "loading") {
    return <RunEmptyState title="Loading" detail="The workbench is syncing workflow state with the server API." loading />;
  }

  if (debugState.status === "running" && !hasWorkflowRun) {
    return (
      <div className="space-y-3">
        <RunStatusHeader debugState={debugState} />
        <RunEmptyState title="Running" detail="Waiting for the first node to start..." loading />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {debugState.error && <RunErrorBox message={debugState.error} />}
      {hasWorkflowRun && <RunStatusHeader debugState={debugState} />}
      {debugState.status === "running" && !hasVisibleNodeRun ? (
        <RunEmptyState
          title="Running"
          detail={nodeId ? "Waiting for this node to start..." : "Waiting for the first node to start..."}
          loading
        />
      ) : hasVisibleNodeRun ? (
        <RunNodeCardList workflow={workflow} nodeStates={visibleNodeStates} debugState={debugState} />
      ) : (
        <RunEmptyState
          title={nodeId ? "No node output" : "No run output"}
          detail={nodeId ? "The latest run has no recorded output for this node." : "Run the workflow to inspect node output."}
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
  const run = debugState.result?.run;

  if (debugState.status === "running") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-brand/30 bg-brand/10 px-3 py-2">
        <Loader2 size={16} className="shrink-0 animate-spin text-brand" aria-hidden />
        <span className="text-sm font-semibold text-brand">Running workflow...</span>
      </div>
    );
  }

  if (debugState.status === "waiting") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
        <UserCheck size={16} className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Awaiting human review…</span>
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
          {failed ? "Run failed" : "Run succeeded"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
      <CheckCircle2 size={16} className="shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-sm font-semibold text-muted-foreground">Run complete</span>
    </div>
  );
}
