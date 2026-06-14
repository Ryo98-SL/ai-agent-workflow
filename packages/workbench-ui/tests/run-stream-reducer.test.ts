import { describe, expect, it } from "vitest";
import type { RunSseEvent } from "@ai-agent-workflow/api-contracts";
import { reduceRunNodeStreamEvent } from "../src/workbench/runStreamReducer";
import type { NodeExecutionState } from "../src/workbench/types";

const empty = () => new Map<string, NodeExecutionState>();

describe("reduceRunNodeStreamEvent", () => {
  it("creates a running node on node.started (llm vs generic)", () => {
    const afterLlm = reduceRunNodeStreamEvent(empty(), {
      type: "node.started",
      runId: "r",
      nodeId: "llm1",
      nodeType: "llm",
    } as RunSseEvent);
    expect(afterLlm.get("llm1")).toMatchObject({ nodeType: "llm", status: "running", streamingText: "" });

    const afterTool = reduceRunNodeStreamEvent(empty(), {
      type: "node.started",
      runId: "r",
      nodeId: "human1",
      nodeType: "humanInput",
    } as RunSseEvent);
    expect(afterTool.get("human1")).toMatchObject({ nodeType: "humanInput", status: "running" });
  });

  it("appends streamed deltas only for a running llm node", () => {
    let states = reduceRunNodeStreamEvent(empty(), {
      type: "node.started",
      runId: "r",
      nodeId: "llm1",
      nodeType: "llm",
    } as RunSseEvent);
    states = reduceRunNodeStreamEvent(states, { type: "node.stream", runId: "r", nodeId: "llm1", delta: "He" } as RunSseEvent);
    states = reduceRunNodeStreamEvent(states, { type: "node.stream", runId: "r", nodeId: "llm1", delta: "llo" } as RunSseEvent);
    const llm = states.get("llm1");
    expect(llm?.nodeType === "llm" && llm.streamingText).toBe("Hello");

    // A stream for an unknown node is a no-op (same reference).
    const same = reduceRunNodeStreamEvent(states, { type: "node.stream", runId: "r", nodeId: "ghost", delta: "x" } as RunSseEvent);
    expect(same).toBe(states);
  });

  it("marks a node succeeded on node.completed and carries output + tokens", () => {
    let states = reduceRunNodeStreamEvent(empty(), {
      type: "node.started",
      runId: "r",
      nodeId: "llm1",
      nodeType: "llm",
    } as RunSseEvent);
    states = reduceRunNodeStreamEvent(states, {
      type: "node.completed",
      runId: "r",
      nodeId: "llm1",
      nodeType: "llm",
      output: "done",
      durationMs: 42,
      inputTokens: 3,
      outputTokens: 7,
    } as RunSseEvent);
    expect(states.get("llm1")).toMatchObject({
      status: "succeeded",
      output: "done",
      durationMs: 42,
      inputTokens: 3,
      outputTokens: 7,
    });
  });

  it("marks a node failed on node.failed", () => {
    let states = reduceRunNodeStreamEvent(empty(), {
      type: "node.started",
      runId: "r",
      nodeId: "tool1",
      nodeType: "tool",
    } as RunSseEvent);
    states = reduceRunNodeStreamEvent(states, {
      type: "node.failed",
      runId: "r",
      nodeId: "tool1",
      nodeType: "tool",
      error: "boom",
      durationMs: 10,
    } as RunSseEvent);
    expect(states.get("tool1")).toMatchObject({ status: "failed", error: "boom" });
  });

  it("ignores completion for an unseen node and run-level events (returns same map)", () => {
    const base = empty();
    const afterOrphan = reduceRunNodeStreamEvent(base, {
      type: "node.completed",
      runId: "r",
      nodeId: "ghost",
      nodeType: "llm",
      output: "x",
      durationMs: 1,
    } as RunSseEvent);
    expect(afterOrphan).toBe(base);

    expect(reduceRunNodeStreamEvent(base, { type: "run.completed", runId: "r", status: "succeeded" } as RunSseEvent)).toBe(base);
  });
});
