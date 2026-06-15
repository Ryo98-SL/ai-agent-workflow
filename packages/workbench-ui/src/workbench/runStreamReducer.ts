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
    // LLM and Agent nodes stream a final answer; Agent also accumulates tool steps.
    if (nodeType === "llm" || nodeType === "agent") {
      next.set(nodeId, { ...base, nodeType, streamingText: "", ...(nodeType === "agent" ? { toolSteps: [] } : {}) });
    } else {
      next.set(nodeId, { ...base, nodeType });
    }
    return next;
  }

  if (event.type === "node.stream") {
    const existing = prev.get(event.nodeId);
    if (!existing || (existing.nodeType !== "llm" && existing.nodeType !== "agent")) return prev;
    const next = new Map(prev);
    next.set(event.nodeId, { ...existing, streamingText: existing.streamingText + event.delta });
    return next;
  }

  if (event.type === "agent.tool") {
    const existing = prev.get(event.nodeId);
    if (!existing || existing.nodeType !== "agent") return prev;
    const steps = [...(existing.toolSteps ?? [])];
    if (event.phase === "start") {
      steps.push({ tool: event.tool ?? "tool", status: "running" });
    } else {
      // Close the most recent running call (the one this end pairs with).
      for (let index = steps.length - 1; index >= 0; index -= 1) {
        if (steps[index].status === "running") {
          steps[index] = { ...steps[index], status: "done", result: event.result };
          break;
        }
      }
    }
    const next = new Map(prev);
    next.set(event.nodeId, { ...existing, toolSteps: steps });
    return next;
  }

  if (event.type === "node.completed") {
    const { nodeId, output, data, durationMs, inputTokens, outputTokens } = event;
    const existing = prev.get(nodeId);
    if (!existing) return prev;
    const completedAt = Date.now();
    const next = new Map(prev);
    if (existing.nodeType === "llm" || existing.nodeType === "agent") {
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
