import { MemorySaver } from "@langchain/langgraph";
import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it } from "vitest";
import { executeWorkflowRuntime, type RuntimeStreamEvent } from "../src/runtime";

function createModelFetch(text = "Runtime stream output.") {
  return async () =>
    new Response(
      JSON.stringify({
        model: "qwen3.5:0.8b",
        created_at: "2026-06-01T00:00:00.000Z",
        message: { role: "assistant", content: text },
        done: true,
        prompt_eval_count: 5,
        eval_count: 6,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
}

describe("workflow runtime executor", () => {
  it("executes through LangGraph stream callbacks and persists checkpoints", async () => {
    const checkpointer = new MemorySaver();
    const streamEvents: RuntimeStreamEvent[] = [];

    const execution = await executeWorkflowRuntime(createDefaultWorkflow(), { topic: "streaming" }, {
      checkpointer,
      fetch: createModelFetch(),
      onStreamEvent: (event) => {
        streamEvents.push(event);
      },
      threadId: "runtime-stream-test",
    });

    expect(execution.ok).toBe(true);
    expect(execution.streamEvents).toEqual(streamEvents);
    expect(streamEvents.some((event) => event.type === "node.started" && event.nodeId === "start1")).toBe(true);
    expect(streamEvents.some((event) => event.type === "node.completed" && event.nodeId === "llm1")).toBe(true);
    if (execution.ok) {
      expect(execution.state.llm1).toMatchObject({ text: "Runtime stream output." });
    }

    const checkpoint = await checkpointer.getTuple({ configurable: { thread_id: "runtime-stream-test" } });
    expect(checkpoint?.checkpoint.channel_values.values).toMatchObject({
      start1: { topic: "streaming" },
      llm1: { text: "Runtime stream output." },
    });
  });

  it("streams node.failed for the running node when the model call throws", async () => {
    const streamEvents: RuntimeStreamEvent[] = [];

    const execution = await executeWorkflowRuntime(createDefaultWorkflow(), { topic: "boom" }, {
      checkpointer: new MemorySaver(),
      // Simulate the "fetch failed" network error the LLM node hit in production.
      fetch: async () => {
        throw new Error("fetch failed");
      },
      onStreamEvent: (event) => {
        streamEvents.push(event);
      },
      threadId: "runtime-failure-test",
    });

    expect(execution.ok).toBe(false);
    // The failing node must emit node.failed so the client can render it instead
    // of leaving the node stuck "running".
    expect(streamEvents.some((event) => event.type === "node.failed" && event.nodeId === "llm1")).toBe(true);
  });
});
