import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultWorkflow, type LLMNode, type ToolNode } from "../../src/domain/workflow/schema";
import { executeLLMNode } from "../../src/domain/runtime/llmAdapter";
import { executeCurrentTimeTool } from "../../src/domain/runtime/toolAdapter";

describe("runtime adapters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs OpenAI-compatible requests and normalizes success responses", async () => {
    const workflow = createDefaultWorkflow();
    const node = workflow.graph.nodes.find((candidate) => candidate.type === "llm") as LLMNode;
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "Mock answer" } }], usage: { total_tokens: 4 } }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeLLMNode(node, {
      modelProvider: { baseURL: "http://mock.test/v1", model: "mock-model", apiKey: "key" },
      testVariables: {},
    });

    expect(result.status).toBe("success");
    expect(result.responseText).toBe("Mock answer");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://mock.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer key" }),
      }),
    );
  });

  it("normalizes missing variable errors before making a request", async () => {
    const workflow = createDefaultWorkflow();
    const node = workflow.graph.nodes.find((candidate) => candidate.type === "llm") as LLMNode;
    const result = await executeLLMNode(
      { ...node, config: { ...node.config, userPrompt: "Hello {{missing}}", variables: {} } },
      { modelProvider: { baseURL: "http://mock.test/v1", model: "mock-model" }, testVariables: {} },
    );

    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("missing_variables");
    expect(result.error?.message).toContain("missing");
  });

  it("normalizes HTTP errors", async () => {
    const workflow = createDefaultWorkflow();
    const node = workflow.graph.nodes.find((candidate) => candidate.type === "llm") as LLMNode;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "No auth", code: "unauthorized" } }), { status: 401 }),
      ),
    );

    const result = await executeLLMNode(node, {
      modelProvider: { baseURL: "http://mock.test/v1", model: "mock-model" },
      testVariables: {},
    });

    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("unauthorized");
    expect(result.request?.url).toContain("/chat/completions");
  });

  it("executes the current time tool", async () => {
    const workflow = createDefaultWorkflow();
    const node = workflow.graph.nodes.find((candidate) => candidate.type === "tool") as ToolNode;
    const result = await executeCurrentTimeTool(node, { testVariables: {} });

    expect(result.status).toBe("success");
    expect(result.responseText).toMatch(/UTC|Coordinated Universal Time/);
  });
});
