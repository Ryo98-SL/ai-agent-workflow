import type { RunEvent, RunInput, WorkflowRun } from "@ai-agent-workflow/api-contracts";
import type { WorkflowNode, WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import type { NodeExecutionState } from "../types";

type RunNodeResult = NonNullable<WorkflowRun["output"]>["nodeResults"][number];

export function runTimestampMs(run: WorkflowRun) {
  return dateMs(run.startedAt ?? run.createdAt) ?? Date.now();
}

export function createNodeExecutionStateFromRunResult({
  events = [],
  node,
  nodeResult,
  run,
}: {
  events?: RunEvent[];
  node: WorkflowNode;
  nodeResult: RunNodeResult;
  run: WorkflowRun;
}): NodeExecutionState {
  const startedAt = runTimestampMs(run);
  const completedAt = dateMs(run.completedAt);
  const durationMs = durationFromRun(run, startedAt, completedAt) ?? durationFromEvents(events, node.id);
  const status: NodeExecutionState["status"] =
    nodeResult.status === "failed" ? "failed" : nodeResult.status === "succeeded" ? "succeeded" : "running";
  const base = {
    nodeId: node.id,
    status,
    startedAt,
    completedAt,
    durationMs,
  };

  if (node.type === "llm") {
    return {
      ...base,
      nodeType: "llm",
      streamingText: "",
      output: nodeResult.output,
      data: nodeResult.data,
    };
  }

  return {
    ...base,
    nodeType: node.type as Exclude<WorkflowNodeType, "llm">,
    output: nodeResult.output,
    data: nodeResult.data,
  };
}

export function nodeReadableText(state: NodeExecutionState) {
  return state.nodeType === "llm"
    ? state.status === "succeeded"
      ? state.output || state.streamingText
      : state.streamingText
    : state.output;
}

export function runNodeResult(run: WorkflowRun | undefined, nodeId: string) {
  return run?.output?.nodeResults.find((result) => result.nodeId === nodeId);
}

export function runInput(run: WorkflowRun | undefined): RunInput | undefined {
  return run?.input;
}

function dateMs(value?: string | null) {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

function durationFromRun(run: WorkflowRun, startedAt?: number, completedAt?: number) {
  if (!startedAt || !completedAt || run.status === "running" || run.status === "queued") {
    return undefined;
  }
  return Math.max(0, completedAt - startedAt);
}

function durationFromEvents(events: RunEvent[], nodeId: string) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if ((event.type === "node.completed" || event.type === "node.failed") && eventNodeId(event.payload) === nodeId) {
      const durationMs = event.payload?.durationMs;
      return typeof durationMs === "number" ? durationMs : undefined;
    }
  }
  return undefined;
}

function eventNodeId(payload?: Record<string, unknown>) {
  const nodeId = payload?.nodeId;
  return typeof nodeId === "string" ? nodeId : undefined;
}
