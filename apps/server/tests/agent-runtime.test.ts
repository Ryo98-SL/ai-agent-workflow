import { MemorySaver } from "@langchain/langgraph";
import { AIMessage, AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { createDefaultWorkflow, createNode, type AgentNode, type WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it, vi } from "vitest";
import { executeWorkflowRuntime, type RuntimeStreamEvent } from "../src/runtime";

// Mock the MCP connector so the agent can bind a "live" MCP tool without a server.
const mcpHooks = vi.hoisted(() => ({ close: vi.fn(async () => {}), connectCalls: 0 }));
vi.mock("../src/mcp/client", async (importActual) => {
  const actual = await importActual<typeof import("../src/mcp/client")>();
  const { tool } = await import("@langchain/core/tools");
  return {
    ...actual,
    connectMcpTools: vi.fn(async () => {
      mcpHooks.connectCalls += 1;
      return {
        tools: [
          tool(async (args: { city?: string }) => `Forecast for ${args.city ?? "?"}: sunny, 25°C`, {
            name: "weather__get_forecast",
            description: "Get the weather forecast for a city.",
            schema: { type: "object", properties: { city: { type: "string" } }, required: [] },
          }),
        ],
        close: mcpHooks.close,
      };
    }),
  };
});

/**
 * A chat model that replays a fixed script of AI messages, one per model turn, so a
 * tool-calling loop can be driven deterministically (tool_call turns, then a final
 * answer). Supports `bindTools` (returns itself so the shared cursor advances across
 * the prebuilt agent's iterations) and streams each turn as a single chunk so the
 * final answer surfaces as `node.stream`.
 */
class ScriptedChatModel extends BaseChatModel {
  private cursor = 0;

  constructor(private readonly script: AIMessage[]) {
    super({});
  }

  _llmType(): string {
    return "scripted";
  }

  // The prebuilt agent binds tools once; we ignore them and drive via the script.
  bindTools(): this {
    return this;
  }

  private nextMessage(): AIMessage {
    const message = this.script[Math.min(this.cursor, this.script.length - 1)];
    this.cursor += 1;
    return message;
  }

  // Non-streaming callers go through the same scripted stream so the cursor advances
  // exactly once per turn (the prebuilt loop runs under streamEvents → uses streaming).
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    let aggregated: ChatGenerationChunk | undefined;
    for await (const chunk of this._streamResponseChunks(messages, options, runManager)) {
      aggregated = aggregated ? aggregated.concat(chunk) : chunk;
    }
    const message = aggregated?.message ?? new AIMessageChunk({ content: "" });
    return { generations: [{ message, text: aggregated?.text ?? "" }] };
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const message = this.nextMessage();
    const text = typeof message.content === "string" ? message.content : "";
    const chunk = new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: message.content,
        tool_calls: message.tool_calls,
        usage_metadata: message.usage_metadata,
      }),
      text,
    });
    await runManager?.handleLLMNewToken(text, undefined, undefined, undefined, undefined, { chunk });
    yield chunk;
  }
}

/** Start → Agent workflow; the agent carries the given config overrides. */
function agentWorkflow(config: Partial<AgentNode["config"]>): WorkflowFile {
  const workflow = createDefaultWorkflow();
  const start = workflow.graph.nodes.find((node) => node.type === "start");
  const agent = createNode("agent", { x: 360, y: 120 }, workflow.graph.nodes);
  if (!start || agent.type !== "agent") {
    throw new Error("Expected start and agent nodes.");
  }
  agent.id = "agent1";
  agent.config = { ...agent.config, query: "Do the task.", ...config };
  return {
    ...workflow,
    graph: {
      nodes: [start, agent],
      edges: [{ id: "edge-start-agent", source: "start1", target: "agent1" }],
    },
  };
}

describe("agent runtime function-calling loop", () => {
  it("runs the prebuilt loop with a built-in tool and returns final text + data.steps", async () => {
    const model = new ScriptedChatModel([
      new AIMessage({ content: "", tool_calls: [{ id: "call-1", name: "currentTime", args: { timezone: "UTC" } }] }),
      new AIMessage({ content: "All done.", usage_metadata: { input_tokens: 5, output_tokens: 3, total_tokens: 8 } }),
    ]);
    const events: RuntimeStreamEvent[] = [];

    const execution = await executeWorkflowRuntime(
      agentWorkflow({ tools: [{ provider: "builtin", providerId: "builtin", toolName: "currentTime", params: {} }] }),
      { topic: "time" },
      {
        checkpointer: new MemorySaver(),
        agentModelFactory: () => model,
        threadId: "agent-builtin",
        onStreamEvent: (event) => {
          events.push(event);
        },
      },
    );

    expect(execution.ok).toBe(true);
    if (!execution.ok) return;
    const agentState = execution.state.agent1 as { text: string; data: { steps: Array<{ name: string; result: string }> } };
    expect(agentState.text).toBe("All done.");
    expect(agentState.data.steps).toHaveLength(1);
    expect(agentState.data.steps[0].name).toBe("currentTime");
    expect(agentState.data.steps[0].result).toBeTruthy();

    // Tool events are re-attributed to the parent agent node.
    const toolStart = events.find((event) => event.type === "agent.tool" && event.phase === "start");
    const toolEnd = events.find((event) => event.type === "agent.tool" && event.phase === "end");
    expect(toolStart?.nodeId).toBe("agent1");
    expect(toolStart?.tool).toBe("currentTime");
    expect(toolEnd?.nodeId).toBe("agent1");

    // The final answer still streams via node.stream on the agent node.
    const stream = events.filter((event) => event.type === "node.stream" && event.nodeId === "agent1");
    expect(stream.map((event) => event.message).join("")).toContain("All done.");
    expect(events.some((event) => event.type === "node.completed" && event.nodeId === "agent1")).toBe(true);
  });

  it("merges author-fixed params with model args and resolves variable-bearing params", async () => {
    const model = new ScriptedChatModel([
      new AIMessage({
        content: "",
        tool_calls: [{ id: "call-1", name: "emailSend", args: { subject: "Hi", body: "Body text" } }],
      }),
      new AIMessage({ content: "Email composed." }),
    ]);

    const execution = await executeWorkflowRuntime(
      agentWorkflow({
        tools: [
          {
            provider: "builtin",
            providerId: "builtin",
            toolName: "emailSend",
            // `to` is author-fixed (a variable) and `send` is author-fixed false;
            // subject/body are left for the model.
            params: { to: "{{start1.topic}}", send: false },
          },
        ],
      }),
      { topic: "vip@example.com" },
      { checkpointer: new MemorySaver(), agentModelFactory: () => model, threadId: "agent-email" },
    );

    expect(execution.ok).toBe(true);
    if (!execution.ok) return;
    const agentState = execution.state.agent1 as { data: { steps: Array<{ name: string; args: unknown; result: string }> } };
    const step = agentState.data.steps[0];
    // The model only supplied subject/body (author-fixed params are hidden from it).
    expect(step.args).toEqual({ subject: "Hi", body: "Body text" });
    // The author-fixed, variable-bearing recipient resolved against run state.
    expect(step.result).toContain("vip@example.com");
  });

  it("never lets the model enable real email sending", async () => {
    const model = new ScriptedChatModel([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call-email-safe",
            name: "emailSend",
            args: { to: "vip@example.com", subject: "Hi", body: "Body text", send: true },
          },
        ],
      }),
      new AIMessage({ content: "Email composed." }),
    ]);
    const delivery = vi.fn(async () => ({ id: "should-not-send" }));

    const execution = await executeWorkflowRuntime(
      agentWorkflow({
        tools: [{ provider: "builtin", providerId: "builtin", toolName: "emailSend", params: {} }],
      }),
      { topic: "vip@example.com" },
      {
        checkpointer: new MemorySaver(),
        agentModelFactory: () => model,
        threadId: "agent-email-safe",
        runId: "agent-email-safe",
        userId: "user-1",
        emailDelivery: delivery,
      },
    );

    expect(execution.ok).toBe(true);
    expect(delivery).not.toHaveBeenCalled();
    if (!execution.ok) return;
    const agentState = execution.state.agent1 as { data: { steps: Array<{ result: string }> } };
    expect(agentState.data.steps[0].result).toContain("dry-run");
  });

  it("uses the LangChain tool-call id for author-enabled real email delivery", async () => {
    const model = new ScriptedChatModel([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call-email-real",
            name: "emailSend",
            args: { to: "vip@example.com", subject: "Hi", body: "Body text" },
          },
        ],
      }),
      new AIMessage({ content: "Email sent." }),
    ]);
    const delivery = vi.fn(async () => ({ id: "email-real-1" }));

    const execution = await executeWorkflowRuntime(
      agentWorkflow({
        tools: [
          {
            provider: "builtin",
            providerId: "builtin",
            toolName: "emailSend",
            params: { send: true },
          },
        ],
      }),
      { topic: "vip@example.com" },
      {
        checkpointer: new MemorySaver(),
        agentModelFactory: () => model,
        threadId: "agent-email-real",
        runId: "run-email-real",
        userId: "user-1",
        emailDelivery: delivery,
      },
    );

    expect(execution.ok).toBe(true);
    expect(delivery).toHaveBeenCalledWith(
      expect.objectContaining({ to: "vip@example.com" }),
      {
        userId: "user-1",
        idempotencyKey: "run-email-real:agent:agent1:call-email-real",
      },
    );
  });

  it("binds a (mock) MCP tool, calls it, and closes the connection in finally", async () => {
    mcpHooks.close.mockClear();
    mcpHooks.connectCalls = 0;
    const model = new ScriptedChatModel([
      new AIMessage({
        content: "",
        tool_calls: [{ id: "call-1", name: "weather__get_forecast", args: { city: "Paris" } }],
      }),
      new AIMessage({ content: "It will be sunny." }),
    ]);

    const execution = await executeWorkflowRuntime(
      agentWorkflow({ tools: [{ provider: "mcp", providerId: "weather", toolName: "get_forecast", params: {} }] }),
      { topic: "weather" },
      {
        checkpointer: new MemorySaver(),
        agentModelFactory: () => model,
        mcpServers: async () => [{ identifier: "weather", name: "Weather", icon: "cloud", url: "http://mcp.test", headers: {} }],
        threadId: "agent-mcp",
      },
    );

    expect(execution.ok).toBe(true);
    if (!execution.ok) return;
    const agentState = execution.state.agent1 as { text: string; data: { steps: Array<{ name: string; result: string }> } };
    expect(agentState.text).toBe("It will be sunny.");
    expect(agentState.data.steps[0].name).toBe("weather__get_forecast");
    expect(agentState.data.steps[0].result).toContain("Paris");
    expect(mcpHooks.connectCalls).toBe(1);
    expect(mcpHooks.close).toHaveBeenCalled();
  });

  it("bounds a runaway tool loop with maxIterations", async () => {
    // The model always asks for another tool call, never answering.
    const model = new ScriptedChatModel([
      new AIMessage({ content: "", tool_calls: [{ id: "loop", name: "currentTime", args: {} }] }),
    ]);

    const execution = await executeWorkflowRuntime(
      agentWorkflow({
        maxIterations: 2,
        tools: [{ provider: "builtin", providerId: "builtin", toolName: "currentTime", params: {} }],
      }),
      { topic: "loop" },
      { checkpointer: new MemorySaver(), agentModelFactory: () => model, threadId: "agent-runaway" },
    );

    expect(execution.ok).toBe(false);
    if (execution.ok) return;
    expect(execution.error.message).toContain("maximum of 2");
  });

  it("rejects the reserved ReAct strategy with a clear error", async () => {
    const model = new ScriptedChatModel([new AIMessage({ content: "unused" })]);
    const execution = await executeWorkflowRuntime(
      agentWorkflow({ strategy: "react" }),
      { topic: "react" },
      { checkpointer: new MemorySaver(), agentModelFactory: () => model, threadId: "agent-react" },
    );

    expect(execution.ok).toBe(false);
    if (execution.ok) return;
    expect(execution.error.message).toContain("ReAct strategy is not implemented yet");
  });
});
