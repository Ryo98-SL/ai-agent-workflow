import { createDefaultWorkflow, createNode } from "@ai-agent-workflow/workflow-domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServerApp as buildServerApp } from "@ai-agent-workflow/server";
import { createInMemoryWorkflowRepository } from "../src/workflows/repository";
import { createInMemoryRunRepository } from "../src/runs/repository";
import { EXAMPLE_KNOWLEDGE_BASE_ID } from "../src/knowledge/constants";
import { createInMemoryKnowledgeRepository } from "../src/knowledge/repository";

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

type HonoApp = ReturnType<typeof buildServerApp>;
type ServerAppOptions = NonNullable<Parameters<typeof buildServerApp>[0]>;

const SEED_TIME = "2026-06-01T00:00:00.000Z";
const TEST_USER = "test-user";

function withSeedMetadata(workflow: ReturnType<typeof createDefaultWorkflow>) {
  return {
    ...workflow,
    metadata: { ...workflow.metadata, name: "Seed Workflow", createdAt: SEED_TIME, updatedAt: SEED_TIME },
  };
}

// Builds the app with an in-memory workflow repo (seeded as "workflow-1") and a
// fake authenticated user, so route tests stay DB-free.
function createTestApp(
  options: {
    seedWorkflow?: ReturnType<typeof createDefaultWorkflow>;
    fetch?: typeof fetch;
    platformCreditsProvider?: ServerAppOptions["platformCreditsProvider"];
    creditBalanceLoader?: ServerAppOptions["creditBalanceLoader"];
    creditConsumer?: ServerAppOptions["creditConsumer"];
  } = {},
): HonoApp {
  const seed = withSeedMetadata(options.seedWorkflow ?? createDefaultWorkflow());
  return buildServerApp({
    fetch: options.fetch,
    resolveUserId: async () => TEST_USER,
    workflows: createInMemoryWorkflowRepository({ id: "workflow-1", userId: TEST_USER, workflow: seed }),
    runs: createInMemoryRunRepository(),
    knowledge: createInMemoryKnowledgeRepository(),
    knowledgeIndexer: { start() {}, stop() {}, trigger() {} },
    platformCreditsProvider: options.platformCreditsProvider,
    creditBalanceLoader: options.creditBalanceLoader,
    creditConsumer: options.creditConsumer,
  });
}

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

async function pollRun(
  app: HonoApp,
  runId: string,
  until: (status: string) => boolean,
  tries = 100,
): Promise<{ status: string; interrupt?: { nodeId: string; prompt: string; actions: unknown[] }; output: { nodeResults: Array<{ nodeId: string }> } | null }> {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const res = await app.request(`/api/runs/${runId}`);
    const run = (await res.json() as { run: { status: string; interrupt?: { nodeId: string; prompt: string; actions: unknown[] }; output: { nodeResults: Array<{ nodeId: string }> } | null } }).run;
    if (until(run.status)) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Run ${runId} did not reach the expected status.`);
}

/** Start → Human Input → done, runnable without a model provider. */
function humanInputSeedWorkflow() {
  const workflow = createDefaultWorkflow();
  const start = workflow.graph.nodes.find((node) => node.type === "start")!;
  const hitl = createNode("humanInput", { x: 300, y: 120 }, workflow.graph.nodes);
  hitl.id = "humanInput1";
  if (hitl.type === "humanInput") {
    hitl.config = { prompt: "approve refund?", actions: [{ id: "approve", label: "OK", value: "yes" }], allowTextInput: true };
  }
  const done = createNode("template", { x: 560, y: 120 }, workflow.graph.nodes);
  done.id = "done1";
  return {
    ...workflow,
    graph: {
      nodes: [start, hitl, done],
      edges: [
        { id: "edge-start-hitl", source: "start1", target: "humanInput1" },
        { id: "edge-hitl-done", source: "humanInput1", target: "done1" },
      ],
    },
  };
}

/** Start → LLM(memory) seed whose human prompt is exactly the topic (Ollama, no credits). */
function memorySeedWorkflow() {
  const workflow = createDefaultWorkflow();
  const llm = workflow.graph.nodes.find((node) => node.type === "llm");
  if (llm?.type === "llm") {
    llm.config = {
      ...llm.config,
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "{{start1.topic}}" },
      ],
      memory: true,
    };
  }
  return workflow;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("workflow API server", () => {
  it("responds to browser CORS requests", async () => {
    const app = createTestApp();
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
    // Credentialed CORS reflects the configured frontend origin (not "*"), so
    // the Better Auth session cookie can be sent cross-origin.
    expect(preflightResponse.headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:5173");
    expect(preflightResponse.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(preflightResponse.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(preflightResponse.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(getResponse.headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:5173");
  });

  it("lists the deterministic seed workflow", async () => {
    const app = createTestApp();
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
    const app = createTestApp();
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
    const app = createTestApp();
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

  it("lists the read-only Chinese example knowledge base", async () => {
    const app = createTestApp();
    const response = await app.request("/api/knowledge-bases");

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      knowledgeBases: [
        {
          id: EXAMPLE_KNOWLEDGE_BASE_ID,
          name: "云舵客服知识库",
          visibility: "example",
          readOnly: true,
        },
      ],
    });
  });

  it("creates a user knowledge base and queues text documents", async () => {
    const app = createTestApp();
    const createResponse = await app.request("/api/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ name: "我的客服知识库", description: "测试" }),
    });

    expect(createResponse.status).toBe(201);
    const created = (await json(createResponse)) as { knowledgeBase: { id: string } };
    const documentResponse = await app.request(`/api/knowledge-bases/${created.knowledgeBase.id}/documents/text`, {
      method: "POST",
      body: JSON.stringify({ title: "退款规则", content: "购买后 7 天内可以申请退款。" }),
    });

    expect(documentResponse.status).toBe(201);
    expect(await json(documentResponse)).toMatchObject({
      document: {
        title: "退款规则",
        status: "queued",
        characterCount: expect.any(Number),
      },
    });
  });

  it("rejects knowledge document quota overages", async () => {
    const app = createTestApp();
    const createResponse = await app.request("/api/knowledge-bases", {
      method: "POST",
      body: JSON.stringify({ name: "限额测试" }),
    });
    const created = (await json(createResponse)) as { knowledgeBase: { id: string } };

    const response = await app.request(`/api/knowledge-bases/${created.knowledgeBase.id}/documents/text`, {
      method: "POST",
      body: JSON.stringify({ title: "超长", content: "x".repeat(100_001) }),
    });

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ error: { code: "validation_error" } });
  });

  it("creates LangGraph workflow runs and events", async () => {
    const app = createTestApp({ fetch: createModelFetch("Server runtime output.") });
    const createRunResponse = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "server tests" } }),
    });

    expect(createRunResponse.status).toBe(201);
    const createdRun = (await json(createRunResponse)) as { run: { id: string; status: string } };
    const runId = createdRun.run.id;
    expect(runId).toBeTruthy();
    expect(createdRun.run.status).toBe("running");

    const run = (await waitForRun(app, runId)) as {
      id: string;
      status: string;
      output: { nodeResults: Array<{ nodeId: string; output: string; data?: unknown }> };
    };

    expect(run.id).toBe(runId);
    expect(run.status).toBe("succeeded");
    expect(run.output.nodeResults).toHaveLength(2);
    expect(run.output.nodeResults.map((result) => result.nodeId)).toEqual(["start1", "llm1"]);
    expect(run.output.nodeResults[1].output).toBe("Server runtime output.");
    expect(run.output.nodeResults[1].data).toMatchObject({
      text: "Server runtime output.",
      usage: { total_tokens: 42 },
      reasoning: null,
    });

    const getRunResponse = await app.request(`/api/runs/${runId}`);
    expect(getRunResponse.status).toBe(200);
    expect(await json(getRunResponse)).toMatchObject({
      run: {
        id: runId,
        workflowId: "workflow-1",
        createdAt: expect.any(String),
      },
    });

    const eventsResponse = await app.request(`/api/runs/${runId}/events`);
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

  it("pauses a Human Input run and resumes it with the reviewer's answer", async () => {
    const app = createTestApp({ seedWorkflow: humanInputSeedWorkflow(), fetch: createModelFetch() });

    const createRunResponse = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "refund" } }),
    });
    expect(createRunResponse.status).toBe(201);
    const runId = ((await json(createRunResponse)) as { run: { id: string } }).run.id;

    const waiting = await pollRun(app, runId, (status) => status === "waiting_human");
    expect(waiting.status).toBe("waiting_human");
    expect(waiting.interrupt?.nodeId).toBe("humanInput1");
    expect(waiting.interrupt?.prompt).toBe("approve refund?");
    expect(waiting.interrupt?.actions).toHaveLength(1);

    const resumeResponse = await app.request(`/api/runs/${runId}/resume`, {
      method: "POST",
      body: JSON.stringify({ action_id: "approve", action_value: "yes" }),
    });
    expect(resumeResponse.status).toBe(200);

    const settled = await pollRun(app, runId, (status) => status === "succeeded" || status === "failed");
    expect(settled.status).toBe("succeeded");
    const ranNodeIds = settled.output?.nodeResults.map((result) => result.nodeId) ?? [];
    expect(ranNodeIds).toContain("humanInput1");
    expect(ranNodeIds).toContain("done1");
  });

  it("rejects resuming a run that is not awaiting human input", async () => {
    const app = createTestApp({ fetch: createModelFetch() });
    const createRunResponse = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "hi" } }),
    });
    const runId = ((await json(createRunResponse)) as { run: { id: string } }).run.id;
    await waitForRun(app, runId);

    const resumeResponse = await app.request(`/api/runs/${runId}/resume`, {
      method: "POST",
      body: JSON.stringify({ action_id: "approve", action_value: "yes" }),
    });
    expect(resumeResponse.status).toBe(409);
  });

  it("accumulates conversation memory across runs with the same conversationId", async () => {
    const requests: Array<{ messages?: Array<{ content: string }> }> = [];
    const fetch = (async (_url: Parameters<typeof globalThis.fetch>[0], init?: Parameters<typeof globalThis.fetch>[1]) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as { messages?: Array<{ content: string }> }) : {};
      requests.push(body);
      return new Response(
        JSON.stringify({
          model: "qwen3.5:0.8b",
          created_at: "2026-06-01T00:00:00.000Z",
          message: { role: "assistant", content: "好的" },
          done: true,
          prompt_eval_count: 5,
          eval_count: 6,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof globalThis.fetch;

    const app = createTestApp({ seedWorkflow: memorySeedWorkflow(), fetch });
    const conversationId = "conv-routes-1";

    const r1 = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "我叫小明" }, conversationId }),
    });
    await waitForRun(app, ((await json(r1)) as { run: { id: string } }).run.id);

    const r2 = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "我叫什么" }, conversationId }),
    });
    await waitForRun(app, ((await json(r2)) as { run: { id: string } }).run.id);

    const contents = (requests.at(-1)?.messages ?? []).map((message) => message.content);
    expect(contents).toContain("我叫小明"); // prior user turn
    expect(contents).toContain("好的"); // prior assistant turn
    expect(contents).toContain("我叫什么"); // current turn
  });

  it("uses transient run model provider settings without storing API keys", async () => {
    const infoLog = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let authorization = "";
    const app = createTestApp({
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
    const app = createTestApp({
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

  it("defaults missing provider preference to the platform provider key for credits runs", async () => {
    const workflow = createDefaultWorkflow();
    workflow.settings.modelProvider = {
      provider: "deepseek",
      baseURL: "https://user-controlled.example",
      model: "deepseek-chat",
    };

    let authorization = "";
    let requestedUrl = "";
    let consumed: { userId: string; tokens: number } | undefined;
    const app = createTestApp({
      seedWorkflow: workflow,
      platformCreditsProvider: async (provider) =>
        provider === "deepseek" ? { apiKey: "platform-deepseek-key", baseURL: "https://api.deepseek.com" } : null,
      creditBalanceLoader: async () => 1000,
      creditConsumer: async (userId, tokens) => {
        consumed = { userId, tokens };
      },
      fetch: async (url, init) => {
        requestedUrl = String(url);
        authorization = requestHeader(init, "authorization") ?? "";
        const requestedBody = JSON.parse(String(init?.body));
        if (requestedBody.stream) {
          return createOpenAIStreamResponse("Credits output.", {
            prompt_tokens: 5,
            completion_tokens: 8,
            total_tokens: 13,
          });
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Credits output." } }],
            usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    const response = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "credits" } }),
    });

    expect(response.status).toBe(201);
    const created = (await json(response)) as { run: { id: string } };
    const run = (await waitForRun(app, created.run.id)) as {
      status: string;
      output: { nodeResults: Array<{ output: string }> };
    };

    expect(run.status).toBe("succeeded");
    expect(run.output.nodeResults[1].output).toBe("Credits output.");
    expect(requestedUrl).toBe("https://api.deepseek.com/chat/completions");
    expect(authorization).toBe("Bearer platform-deepseek-key");
    expect(consumed).toEqual({ userId: TEST_USER, tokens: 13 });

    const readResponse = await app.request("/api/workflows/workflow-1");
    const stored = (await json(readResponse)) as { workflow: { workflow: { settings: { modelProvider?: { apiKey?: string } } } } };
    expect(stored.workflow.workflow.settings.modelProvider?.apiKey).toBeUndefined();
  });

  it("fails missing required Start input before model calls", async () => {
    let called = false;
    const workflow = createDefaultWorkflow();
    const start = workflow.graph.nodes.find((node) => node.type === "start");
    if (start?.type === "start") {
      start.config.fields = [{ name: "topic", required: true }];
    }
    const app = createTestApp({
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
      llm.config.messages = [{ role: "user", content: "Explain {{start1.topic}} to {{start1.audience}}." }];
    }

    const app = createTestApp({ seedWorkflow: workflow, fetch: createModelFetch("Defaulted output.") });
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
    const app = createTestApp({
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
      id: "template1",
      type: "template",
      label: "Template",
      position: { x: 360, y: 240 },
      config: {},
    });
    workflow.graph.edges = [{ id: "edge-start-template", source: "start1", target: "template1" }];
    const app = createTestApp({ seedWorkflow: workflow, fetch: createModelFetch() });

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
      nodeId: "template1",
      output: "template placeholder saved.",
      data: {
        type: "template",
        label: "Template",
        placeholder: true,
      },
    });
  });

  it("fails missing namespaced prompt variables without model calls", async () => {
    let called = false;
    const workflow = createDefaultWorkflow();
    const llm = workflow.graph.nodes.find((node) => node.type === "llm");
    if (llm?.type === "llm") {
      llm.config.messages = [{ role: "user", content: "Explain {{start1.missing}}." }];
    }
    const app = createTestApp({
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
    const app = createTestApp({
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

  it("deletes a workflow (authed, owner-scoped)", async () => {
    const app = createTestApp();

    const created = await app.request("/api/workflows", {
      method: "POST",
      body: JSON.stringify({ workflow: createDefaultWorkflow() }),
    });
    const { workflow } = (await json(created)) as { workflow: { id: string } };

    const deleteResponse = await app.request(`/api/workflows/${workflow.id}`, { method: "DELETE" });
    expect(deleteResponse.status).toBe(204);

    const getResponse = await app.request(`/api/workflows/${workflow.id}`);
    expect(getResponse.status).toBe(404);

    const missingDelete = await app.request("/api/workflows/does-not-exist", { method: "DELETE" });
    expect(missingDelete.status).toBe(404);
  });

  it("requires authentication to list workflows", async () => {
    const app = buildServerApp({
      resolveUserId: async () => null,
      workflows: createInMemoryWorkflowRepository(),
      knowledge: createInMemoryKnowledgeRepository(),
      knowledgeIndexer: { start() {}, stop() {}, trigger() {} },
    });

    const response = await app.request("/api/workflows");
    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("runs an anonymous workflow from an inline definition", async () => {
    const app = buildServerApp({
      fetch: createModelFetch("Anonymous output."),
      resolveUserId: async () => null,
      workflows: createInMemoryWorkflowRepository(),
      knowledge: createInMemoryKnowledgeRepository(),
      knowledgeIndexer: { start() {}, stop() {}, trigger() {} },
    });

    const response = await app.request("/api/workflows/local/runs", {
      method: "POST",
      body: JSON.stringify({
        input: { topic: "anon" },
        workflow: withSeedMetadata(createDefaultWorkflow()),
      }),
    });

    expect(response.status).toBe(201);
    const created = (await json(response)) as { run: { id: string } };
    const run = (await waitForRun(app, created.run.id)) as {
      status: string;
      output: { nodeResults: Array<{ output: string }> };
    };

    expect(run.status).toBe("succeeded");
    expect(run.output.nodeResults).toHaveLength(2);
    expect(run.output.nodeResults[1].output).toBe("Anonymous output.");
  });

  it("lists run history for a workflow (authed)", async () => {
    const app = createTestApp({ fetch: createModelFetch("History output.") });

    const created = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "history" } }),
    });
    const { run } = (await json(created)) as { run: { id: string } };
    await waitForRun(app, run.id);

    const historyResponse = await app.request("/api/workflows/workflow-1/runs");
    expect(historyResponse.status).toBe(200);
    const { runs } = (await json(historyResponse)) as { runs: Array<{ id: string; status: string }> };
    expect(runs.some((r) => r.id === run.id && r.status === "succeeded")).toBe(true);
  });

  it("deletes an authenticated workflow run and its history row", async () => {
    const app = createTestApp({ fetch: createModelFetch("Delete history output.") });

    const created = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "delete-history" } }),
    });
    const { run } = (await json(created)) as { run: { id: string } };
    await waitForRun(app, run.id);

    const deleteResponse = await app.request(`/api/runs/${run.id}`, { method: "DELETE" });
    expect(deleteResponse.status).toBe(204);

    const historyResponse = await app.request("/api/workflows/workflow-1/runs");
    const { runs } = (await json(historyResponse)) as { runs: Array<{ id: string }> };
    expect(runs.some((r) => r.id === run.id)).toBe(false);

    const getDeletedResponse = await app.request(`/api/runs/${run.id}`);
    expect(getDeletedResponse.status).toBe(404);
  });
});
