import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServerApp } from "@ai-agent-workflow/server";

async function json(response: Response) {
  return response.json() as Promise<unknown>;
}

function createModelFetch(text = "LangGraph is ready.") {
  return async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const requestUrl = String(url);
    const body = requestUrl.includes("/api/chat")
      ? {
          model: "qwen3.5:0.8b",
          created_at: "2026-06-01T00:00:00.000Z",
          message: { role: "assistant", content: text },
          done: true,
          prompt_eval_count: 20,
          eval_count: 22,
        }
      : {
          choices: [
            {
              message: {
                content: text,
                reasoning_content: "brief reasoning",
              },
            },
          ],
          usage: { total_tokens: 42 },
          request: init?.body ? JSON.parse(String(init.body)) : undefined,
        };

    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
}

function requestHeader(init: Parameters<typeof fetch>[1] | undefined, name: string) {
  return new Headers(init?.headers).get(name);
}

function createOpenAIStreamResponse(text: string, usage: Record<string, unknown>) {
  const chunks = [
    { choices: [{ delta: { role: "assistant" } }] },
    { choices: [{ delta: { content: text } }] },
    { choices: [{ delta: {}, finish_reason: "stop" }], usage },
  ];

  return new Response(`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

type HonoApp = ReturnType<typeof createServerApp>;

async function waitForRun(app: HonoApp, runId: string): Promise<unknown> {
  const streamResponse = await app.request(`/api/runs/${runId}/stream`);
  const reader = streamResponse.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const event = JSON.parse(line.slice(6)) as { type: string };
        if (event.type === "run.completed") {
          reader.cancel().catch(() => {});
          const runRes = await app.request(`/api/runs/${runId}`);
          return (await runRes.json() as { run: unknown }).run;
        }
      }
    }
  }
  const runRes = await app.request(`/api/runs/${runId}`);
  return (await runRes.json() as { run: unknown }).run;
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
          nodeCount: 2,
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
    const createdRun = (await json(createRunResponse)) as { run: { id: string; status: string } };
    expect(createdRun.run.id).toBe("run-1");
    expect(createdRun.run.status).toBe("running");

    const run = (await waitForRun(app, "run-1")) as {
      id: string;
      status: string;
      output: { nodeResults: Array<{ nodeId: string; output: string; data?: unknown }> };
    };

    expect(run.id).toBe("run-1");
    expect(run.status).toBe("succeeded");
    expect(run.output.nodeResults).toHaveLength(2);
    expect(run.output.nodeResults.map((result) => result.nodeId)).toEqual(["start1", "llm1"]);
    expect(run.output.nodeResults[1].output).toBe("Server runtime output.");
    expect(run.output.nodeResults[1].data).toMatchObject({
      text: "Server runtime output.",
      usage: { total_tokens: 42 },
      reasoning: null,
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

  it("uses transient run model provider settings without storing API keys", async () => {
    const infoLog = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let authorization = "";
    const app = createServerApp({
      fetch: async (_url, init) => {
        authorization = requestHeader(init, "authorization") ?? "";
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Transient key output." } }],
            usage: { total_tokens: 8 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    const createRunResponse = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({
        input: { topic: "transient key" },
        modelProvider: {
          provider: "deepseek",
          baseURL: "https://api.deepseek.com",
          model: "deepseek-chat",
          apiKey: "transient-deepseek-key",
        },
      }),
    });

    expect(createRunResponse.status).toBe(201);
    const createdTransient = (await json(createRunResponse)) as { run: { id: string } };
    await waitForRun(app, createdTransient.run.id);

    const readResponse = await app.request("/api/workflows/workflow-1");
    const stored = (await json(readResponse)) as { workflow: { workflow: { settings: { modelProvider?: { apiKey?: string } } } } };

    expect(authorization).toBe("Bearer transient-deepseek-key");
    expect(stored.workflow.workflow.settings.modelProvider?.apiKey).toBeUndefined();

    const logOutput = [...infoLog.mock.calls, ...errorLog.mock.calls].flat().join("\n");
    expect(logOutput).toContain("run.create_requested");
    expect(logOutput).toContain("runtime.model.invoke_started");
    expect(logOutput).not.toContain("transient-deepseek-key");
    expect(logOutput).not.toContain("Explain {{start1.topic}}");
  });

  it("uses node model settings with provider keyring fallback", async () => {
    const workflow = createDefaultWorkflow();
    workflow.settings.modelProvider = {
      provider: "deepseek",
      baseURL: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    };
    workflow.settings.modelProviderKeys = { openai: "provider-openai-key" };
    const llm = workflow.graph.nodes.find((node) => node.type === "llm");
    if (llm?.type === "llm") {
      llm.config.modelSettings = {
        provider: "openai",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-5.2",
        temperature: 0.2,
        maxTokens: 1200,
      };
    }

    let authorization = "";
    let requestedUrl = "";
    let requestedBody = {} as {
      model?: string;
      max_completion_tokens?: number;
      max_tokens?: number;
      stream?: boolean;
      temperature?: number;
    };
    const app = createServerApp({
      seedWorkflow: workflow,
      fetch: async (url, init) => {
        requestedUrl = String(url);
        authorization = requestHeader(init, "authorization") ?? "";
        requestedBody = JSON.parse(String(init?.body));
        if (requestedBody.stream) {
          return createOpenAIStreamResponse("Node settings output.", { total_tokens: 9 });
        }

        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Node settings output." } }],
            usage: { total_tokens: 9 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    const response = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "node settings" } }),
    });

    expect(response.status).toBe(201);
    const createdNodeSettings = (await json(response)) as { run: { id: string } };
    const nodeSettingsRun = (await waitForRun(app, createdNodeSettings.run.id)) as {
      status: string;
      output: { nodeResults: Array<{ output: string }> };
    };

    expect(nodeSettingsRun.status).toBe("succeeded");
    expect(nodeSettingsRun.output.nodeResults[1].output).toBe("Node settings output.");
    expect(requestedUrl).toBe("https://api.openai.com/v1/chat/completions");
    expect(authorization).toBe("Bearer provider-openai-key");
    expect(requestedBody).toMatchObject({ model: "gpt-5.2", max_completion_tokens: 1200, temperature: 0.2 });
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

    expect(response.status).toBe(201);
    const createdMissing = (await json(response)) as { run: { id: string } };
    const missingRun = (await waitForRun(app, createdMissing.run.id)) as {
      status: string;
      error: { message: string };
      output: { nodeResults: unknown[] };
    };

    expect(missingRun.status).toBe("failed");
    expect(missingRun.error.message).toContain('Missing required Start field "topic"');
    expect(missingRun.output.nodeResults).toHaveLength(1);
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
    expect(response.status).toBe(201);
    const createdDefaults = (await json(response)) as { run: { id: string } };
    const defaultsRun = (await waitForRun(app, createdDefaults.run.id)) as {
      status: string;
      output: { nodeResults: Array<{ data?: Record<string, unknown> }> };
    };

    expect(defaultsRun.status).toBe("succeeded");
    expect(defaultsRun.output.nodeResults[0].data).toEqual({ topic: "default topic", audience: null });
  });

  it("creates workflow runs with Ollama provider settings", async () => {
    const workflow = createDefaultWorkflow();
    workflow.settings.modelProvider = {
      provider: "ollama",
      baseURL: "http://127.0.0.1:11434",
      model: "llama3.2",
    };
    let requestedUrl = "";
    const app = createServerApp({
      seedWorkflow: workflow,
      fetch: async (url) => {
        requestedUrl = String(url);
        return new Response(
          JSON.stringify({
            model: "llama3.2",
            created_at: "2026-06-01T00:00:00.000Z",
            message: { role: "assistant", content: "Ollama runtime output." },
            done: true,
            prompt_eval_count: 7,
            eval_count: 5,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    const response = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "ollama" } }),
    });
    expect(response.status).toBe(201);
    const createdOllama = (await json(response)) as { run: { id: string } };
    const ollamaRun = (await waitForRun(app, createdOllama.run.id)) as {
      status: string;
      output: { nodeResults: Array<{ output: string; data?: unknown }> };
    };

    expect(ollamaRun.status).toBe("succeeded");
    expect(requestedUrl).toContain("/api/chat");
    expect(ollamaRun.output.nodeResults[1].output).toBe("Ollama runtime output.");
    expect(ollamaRun.output.nodeResults[1].data).toMatchObject({
      text: "Ollama runtime output.",
      reasoning: null,
    });
  });

  it("saves placeholder output for reachable node types that do not have runtime implementations yet", async () => {
    const workflow = createDefaultWorkflow();
    workflow.graph.nodes.push({
      id: "tool1",
      type: "tool",
      label: "Tool",
      position: { x: 360, y: 240 },
      config: { adapter: "currentTime", timezone: "UTC" },
    });
    workflow.graph.edges = [{ id: "edge-start-tool", source: "start1", target: "tool1" }];
    const app = createServerApp({ seedWorkflow: workflow, fetch: createModelFetch() });

    const response = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "unsupported" } }),
    });
    expect(response.status).toBe(201);
    const createdPlaceholder = (await json(response)) as { run: { id: string } };
    const placeholderRun = (await waitForRun(app, createdPlaceholder.run.id)) as {
      status: string;
      output: { nodeResults: Array<{ nodeId: string; output: string; data?: Record<string, unknown> }> };
    };

    expect(placeholderRun.status).toBe("succeeded");
    expect(placeholderRun.output.nodeResults).toHaveLength(2);
    expect(placeholderRun.output.nodeResults[1]).toMatchObject({
      nodeId: "tool1",
      output: "tool placeholder saved.",
      data: {
        type: "tool",
        label: "Tool",
        config: { adapter: "currentTime", timezone: "UTC" },
        placeholder: true,
      },
    });
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
    expect(response.status).toBe(201);
    const createdVars = (await json(response)) as { run: { id: string } };
    const varsRun = (await waitForRun(app, createdVars.run.id)) as {
      status: string;
      error: { message: string };
    };

    expect(varsRun.status).toBe("failed");
    expect(varsRun.error.message).toContain("start1.missing");
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
    expect(response.status).toBe(201);
    const createdFail = (await json(response)) as { run: { id: string } };
    const failedRun = (await waitForRun(app, createdFail.run.id)) as {
      status: string;
      error: { message: string };
      output: { nodeResults: unknown[] };
    };

    expect(failedRun.status).toBe("failed");
    expect(failedRun.error.message).toContain("nope");
    expect(failedRun.output.nodeResults).toHaveLength(2);
  });
});
