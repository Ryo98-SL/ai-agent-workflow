import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import type { RunInput, WorkflowRun } from "@ai-agent-workflow/api-contracts";
import type { WorkflowFile, WorkflowNode } from "@ai-agent-workflow/workflow-domain";
import type { DebugState, NodeExecutionState } from "../types";
import { useWorkflowRuns } from "../../data/useWorkflows";
import {
  buildInspectorSections,
  formatRunDuration,
  RunNodeExecutionDetails,
} from "./RunNodeCard";
import { RunEmptyState, RunErrorBox } from "./RunOutputPrimitives";
import {
  createNodeExecutionStateFromRunResult,
  nodeReadableText,
  runInput,
  runNodeResult,
  runTimestampMs,
} from "./runHistoryState";

type NodeRunListProps = {
  workflow: WorkflowFile;
  workflowId?: string;
  node: WorkflowNode;
  debugState: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
};

type NodeRunListItem = {
  id: string;
  openByDefault: boolean;
  durationMs?: number;
  runInput?: RunInput;
  startedAt: number;
  state: NodeExecutionState;
};

export function NodeRunList({ workflow, workflowId, node, debugState, nodeStates }: NodeRunListProps) {
  const { data, isLoading } = useWorkflowRuns(workflowId);
  const items = useMemo(
    () => buildNodeRunListItems(workflow, node, debugState, nodeStates, data?.runs ?? []),
    [data?.runs, debugState, node, nodeStates, workflow],
  );

  if (debugState.error) {
    return <RunErrorBox message={debugState.error} />;
  }

  if (isLoading && items.length === 0) {
    return <RunEmptyState title="Loading" detail="Loading node history." loading />;
  }

  if (debugState.status === "loading") {
    return <RunEmptyState title="Loading" detail="Loading run output." loading />;
  }

  if (debugState.status === "running" && items.length === 0) {
    return <RunEmptyState title="Running" detail="Waiting for this node to start..." loading />;
  }

  if (items.length === 0) {
    const hasRuns = (data?.runs.length ?? 0) > 0;
    return hasRuns ? (
      <RunEmptyState title="No history item" detail="No workflow run has recorded output for this node." />
    ) : (
      <RunEmptyState title="No history" detail="Run the workflow to inspect this node's execution history." />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <NodeRunListRow key={item.id} item={item} workflow={workflow} node={node} />
      ))}
    </div>
  );
}

function buildNodeRunListItems(
  workflow: WorkflowFile,
  node: WorkflowNode,
  debugState: DebugState,
  nodeStates: Map<string, NodeExecutionState>,
  workflowRuns: WorkflowRun[],
): NodeRunListItem[] {
  const items: NodeRunListItem[] = [];
  const liveState = nodeStates.get(node.id);
  if (liveState) {
    items.push({
      id: `${debugState.result?.run.id ?? "current"}-${node.id}`,
      openByDefault: true,
      durationMs: liveState.durationMs,
      runInput: debugState.result?.run.input,
      startedAt: liveState.startedAt,
      state: liveState,
    });
  }

  const currentRunId = debugState.result?.run.id;
  for (const run of workflowRuns) {
    if (run.id === currentRunId && liveState) {
      continue;
    }
    const nodeResult = runNodeResult(run, node.id);
    if (!nodeResult) {
      continue;
    }
    items.push({
      id: `${run.id}-${node.id}`,
      openByDefault: items.length === 0,
      durationMs: undefined,
      runInput: runInput(run),
      startedAt: runTimestampMs(run),
      state: createNodeExecutionStateFromRunResult({ node, nodeResult, run }),
    });
  }

  return items.sort((a, b) => b.startedAt - a.startedAt).map((item, index) => ({ ...item, openByDefault: index === 0 }));
}

function NodeRunListRow({ item, workflow, node }: { item: NodeRunListItem; workflow: WorkflowFile; node: WorkflowNode }) {
  const [open, setOpen] = useState(item.openByDefault || item.state.status === "running");

  useEffect(() => {
    if (item.openByDefault) {
      setOpen(true);
    }
  }, [item.id, item.openByDefault]);

  useEffect(() => {
    if (item.state.status === "running") {
      setOpen(true);
    }
  }, [item.state.status]);

  const duration = formatRunDuration(item.durationMs);
  const sections = buildInspectorSections(workflow, node, item.state, item.runInput);
  const readableText = nodeReadableText(item.state);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-accent"
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronRight size={14} className={["shrink-0 transition-transform", open ? "rotate-90" : ""].join(" ")} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{formatRunDate(item.startedAt)}</span>
        {duration && <span className="shrink-0 text-xs text-muted-foreground">{duration}</span>}
        <NodeRunStatusIcon state={item.state} />
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2.5">
          <RunNodeExecutionDetails readableText={readableText} sections={sections} state={item.state} />
        </div>
      )}
    </div>
  );
}

function NodeRunStatusIcon({ state }: { state: NodeExecutionState }) {
  if (state.status === "running") {
    return <Loader2 size={14} className="shrink-0 animate-spin text-brand" aria-hidden />;
  }

  if (state.status === "failed") {
    return <AlertCircle size={14} className="shrink-0 text-destructive" aria-hidden />;
  }

  return <CheckCircle2 size={14} className="shrink-0 text-brand" aria-hidden />;
}

function formatRunDate(ms: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ms));
}
