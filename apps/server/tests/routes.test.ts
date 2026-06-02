import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it } from "vitest";
import { createServerApp } from "@ai-agent-workflow/server";

async function json(response: Response) {
  return response.json() as Promise<unknown>;
}

function createModelFetch(text = "LangGraph is ready.") {
  return async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: text,
              reasoning: "brief reasoning",
            },
          },
        ],
        usage: { total_tokens: 42 },
        request: init?.body ? JSON.parse(String(init.body)) : undefined,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
}

describe("workflow API server", () => {
  it("responds to browser CORS requests", async () => {
    const app = createServerApp();
    const preflightResponse = await app.request("/api/workflows", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    const getResponse = await app.request("/api/workflows", {
      headers: {
        Origin: "http://127.0.0.1:5173",
      },
    });

    expect(preflightResponse.status).toBe(204);
    expect(preflightResponse.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(preflightResponse.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(preflightResponse.headers.get("Access-Control-Allow-Headers")).toBe("content-type");
    expect(getResponse.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("lists the deterministic seed workflow", async () => {
    const app = createServerApp();
    const response = await app.request("/api/workflows");

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      workflows: [
        {
          id: "workflow-1",
          name: "Seed Workflow",
          description: "Local workflow debug project.",
          updatedAt: "2026-06-01T00:00:00.000Z",
          nodeCount: 3,
          edgeCount: 1,
        },
      ],
    });
  });

  it("creates, reads, and updates workflows", async () => {
    const app = createServerApp();
    const workflow = createDefaultWorkflow();
    workflow.metadata.name = "Created Workflow";

    const createResponse = await app.request("/api/workflows", {
      method: "POST",
      body: JSON.stringify({ workflow }),
    });

    expect(createResponse.status).toBe(201);
    const created = (await json(createResponse)) as { workflow: { id: string } };
    expect(created.workflow.id).toBe("workflow-2");

    const readResponse = await app.request("/api/workflows/workflow-2");
    expect(readResponse.status).toBe(200);
    expect(await json(readResponse)).toMatchObject({
      workflow: {
        id: "workflow-2",
        workflow: {
          metadata: {
            name: "Created Workflow",
          },
        },
      },
    });

    workflow.metadata.name = "Updated Workflow";
    const updateResponse = await app.request("/api/workflows/workflow-2", {
      method: "PUT",
      body: JSON.stringify({ workflow }),
    });

    expect(updateResponse.status).toBe(200);
    expect(await json(updateResponse)).toMatchObject({
      workflow: {
        id: "workflow-2",
        workflow: {
          metadata: {
            name: "Updated Workflow",
          },
        },
      },
    });
  });

  it("normalizes validation and not found errors", async () => {
    const app = createServerApp();
    const invalidResponse = await app.request("/api/workflows", {
      method: "POST",
      body: JSON.stringify({ workflow: { version: "2" } }),
    });
    const missingResponse = await app.request("/api/workflows/missing");

    expect(invalidResponse.status).toBe(400);
    expect(await json(invalidResponse)).toMatchObject({
      error: {
        code: "validation_error",
      },
    });
    expect(missingResponse.status).toBe(404);
    expect(await json(missingResponse)).toEqual({
      error: {
        code: "not_found",
        message: "Workflow missing was not found.",
      },
    });
  });

  it("creates LangGraph workflow runs and events", async () => {
    const app = createServerApp({ fetch: createModelFetch("Server runtime output.") });
    const createRunResponse = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "server tests" } }),
    });

    expect(createRunResponse.status).toBe(201);
    const createdRun = (await json(createRunResponse)) as {
      run: {
        id: string;
        status: string;
        output: { nodeResults: Array<{ nodeId: string; output: string; data?: unknown }> };
      };
    };

    expect(createdRun.run.id).toBe("run-1");
    expect(createdRun.run.status).toBe("succeeded");
    expect(createdRun.run.output.nodeResults).toHaveLength(2);
    expect(createdRun.run.output.nodeResults.map((result) => result.nodeId)).toEqual(["start1", "llm1"]);
    expect(createdRun.run.output.nodeResults[1].output).toBe("Server runtime output.");
    expect(createdRun.run.output.nodeResults[1].data).toMatchObject({
      text: "Server runtime output.",
      usage: { total_tokens: 42 },
      reasoning: "brief reasoning",
    });

    const getRunResponse = await app.request("/api/runs/run-1");
    expect(getRunResponse.status).toBe(200);
    expect(await json(getRunResponse)).toMatchObject({
      run: {
        id: "run-1",
        workflowId: "workflow-1",
        createdAt: "2026-06-01T00:00:10.000Z",
      },
    });

    const eventsResponse = await app.request("/api/runs/run-1/events");
    expect(eventsResponse.status).toBe(200);
    const events = (await json(eventsResponse)) as { events: Array<{ type: string }> };
    expect(events.events.map((event) => event.type)).toEqual([
      "run.created",
      "run.started",
      "node.completed",
      "node.completed",
      "run.completed",
    ]);
  });

  it("fails missing required Start input before model calls", async () => {
    let called = false;
    const workflow = createDefaultWorkflow();
    const start = workflow.graph.nodes.find((node) => node.type === "start");
    if (start?.type === "start") {
      start.config.fields = [{ name: "topic", required: true }];
    }
    const app = createServerApp({
      seedWorkflow: workflow,
      fetch: async () => {
        called = true;
        return new Response("{}", { status: 200 });
      },
    });

    const response = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: {} }),
    });
    const body = (await json(response)) as { run: { status: string; error: { message: string }; output: { nodeResults: unknown[] } } };

    expect(response.status).toBe(201);
    expect(body.run.status).toBe("failed");
    expect(body.run.error.message).toContain('Missing required Start field "topic"');
    expect(body.run.output.nodeResults).toHaveLength(1);
    expect(called).toBe(false);
  });

  it("uses Start defaults and optional nulls", async () => {
    const workflow = createDefaultWorkflow();
    const start = workflow.graph.nodes.find((node) => node.type === "start");
    const llm = workflow.graph.nodes.find((node) => node.type === "llm");
    if (start?.type === "start") {
      start.config.fields = [
        { name: "topic", required: true, defaultValue: "default topic" },
        { name: "audience", required: false },
      ];
    }
    if (llm?.type === "llm") {
      llm.config.userPrompt = "Explain {{start1.topic}} to {{start1.audience}}.";
    }

    const app = createServerApp({ seedWorkflow: workflow, fetch: createModelFetch("Defaulted output.") });
    const response = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: {} }),
    });
    const body = (await json(response)) as { run: { status: string; output: { nodeResults: Array<{ data?: Record<string, unknown> }> } } };

    expect(body.run.status).toBe("succeeded");
    expect(body.run.output.nodeResults[0].data).toEqual({ topic: "default topic", audience: null });
  });

  it("returns clear failed runs for unsupported reachable nodes", async () => {
    const workflow = createDefaultWorkflow();
    workflow.graph.edges = [{ id: "edge-start-tool", source: "start1", target: "tool-current-time" }];
    const app = createServerApp({ seedWorkflow: workflow, fetch: createModelFetch() });

    const response = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "unsupported" } }),
    });
    const body = (await json(response)) as { run: { status: string; error: { message: string } } };

    expect(body.run.status).toBe("failed");
    expect(body.run.error.message).toContain("unsupported runtime type");
  });

  it("fails missing namespaced prompt variables without model calls", async () => {
    let called = false;
    const workflow = createDefaultWorkflow();
    const llm = workflow.graph.nodes.find((node) => node.type === "llm");
    if (llm?.type === "llm") {
      llm.config.userPrompt = "Explain {{start1.missing}}.";
    }
    const app = createServerApp({
      seedWorkflow: workflow,
      fetch: async () => {
        called = true;
        return new Response("{}", { status: 200 });
      },
    });

    const response = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "variables" } }),
    });
    const body = (await json(response)) as { run: { status: string; error: { message: string } } };

    expect(body.run.status).toBe("failed");
    expect(body.run.error.message).toContain("start1.missing");
    expect(called).toBe(false);
  });

  it("captures model endpoint failures as failed runs", async () => {
    const app = createServerApp({
      fetch: async () => new Response(JSON.stringify({ error: "nope" }), { status: 503 }),
    });

    const response = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "model failure" } }),
    });
    const body = (await json(response)) as { run: { status: string; error: { message: string }; output: { nodeResults: unknown[] } } };

    expect(body.run.status).toBe("failed");
    expect(body.run.error.message).toContain("HTTP 503");
    expect(body.run.output.nodeResults).toHaveLength(2);
  });
});
