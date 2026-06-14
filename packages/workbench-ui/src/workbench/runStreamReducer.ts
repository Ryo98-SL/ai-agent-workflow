import type { RunSseEvent } from "@ai-agent-workflow/api-contracts";
import type { NodeExecutionState } from "./types";

/**
 * Applies one node-level run SSE event to a node-state map, returning a new map
 * (or the same reference when the event doesn't apply). Shared by the live run
 * panel ({@link useWorkflowExecution}) and the Run History resume stream so both
 * render identical progress. Run-level events (`run.completed`/`run.waiting`/
 * `run.started`) carry no node state and are left to the caller — they return the
 * map unchanged here.
 */
export function reduceRunNodeStreamEvent(
  prev: Map<string, NodeExecutionState>,
  event: RunSseEvent,
): Map<string, NodeExecutionState> {
  if (event.type === "node.started") {
    const { nodeId, nodeType } = event;
    const next = new Map(prev);
    const base = { nodeId, status: "running" as const, startedAt: Date.now() };
    if (nodeType === "llm") {
      next.set(nodeId, { ...base, nodeType: "llm", streamingText: "" });
    } else {
      next.set(nodeId, { ...base, nodeType });
    }
    return next;
  }

  if (event.type === "node.stream") {
    const existing = prev.get(event.nodeId);
    if (!existing || existing.nodeType !== "llm") return prev;
    const next = new Map(prev);
    next.set(event.nodeId, { ...existing, streamingText: existing.streamingText + event.delta });
    return next;
  }

  if (event.type === "node.completed") {
    const { nodeId, output, data, durationMs, inputTokens, outputTokens } = event;
    const existing = prev.get(nodeId);
    if (!existing) return prev;
    const completedAt = Date.now();
    const next = new Map(prev);
    if (existing.nodeType === "llm") {
      next.set(nodeId, {
        ...existing,
        status: "succeeded",
        completedAt,
        durationMs,
        output,
        data,
        inputTokens,
        outputTokens,
      });
    } else {
      next.set(nodeId, { ...existing, status: "succeeded", completedAt, durationMs, output, data });
    }
    return next;
  }

  if (event.type === "node.failed") {
    const { nodeId, error, durationMs } = event;
    const existing = prev.get(nodeId);
    if (!existing) return prev;
    const completedAt = Date.now();
    const next = new Map(prev);
    next.set(nodeId, { ...existing, status: "failed", completedAt, durationMs, error });
    return next;
  }

  return prev;
}
