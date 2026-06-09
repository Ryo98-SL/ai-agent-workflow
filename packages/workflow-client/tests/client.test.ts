import { createServerApp } from "@ai-agent-workflow/server";
import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it, vi } from "vitest";
import { WorkflowClientError, createWorkflowClient } from "@ai-agent-workflow/workflow-client";

function jsonResponse(
  body: unknown,
  init: { status?: number; statusText?: string; headers?: Record<string, string> } = {},
) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

describe("workflow client", () => {
  it("lists workflows through fetch and validates the response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        workflows: [
          {
            id: "workflow-1",
            name: "Demo",
            updatedAt: "2026-06-01T00:00:00.000Z",
            nodeCount: 1,
            edgeCount: 0,
          },
        ],
      }),
    );
    const client = createWorkflowClient({ baseUrl: "http://api.test/", fetch: fetchMock });

    await expect(client.listWorkflows()).resolves.toMatchObject({
      workflows: [{ id: "workflow-1" }],
    });
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/api/workflows", {
      method: "GET",
      credentials: "include",
      headers: undefined,
      body: undefined,
    });
  });

  it("sends workflow updates as JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        workflow: {
          id: "workflow-1",
          workflow: createDefaultWorkflow(),
        },
      }),
    );
    const client = createWorkflowClient({ baseUrl: "http://api.test", fetch: fetchMock });
    const workflow = createDefaultWorkflow();

    await client.updateWorkflow("workflow-1", { workflow });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/workflows/workflow-1",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflow }),
      }),
    );
  });

  it("lists knowledge bases and validates the response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        knowledgeBases: [
          {
            id: "kb_customer_support_example",
            name: "云舵客服知识库",
            description: "Demo",
            visibility: "example",
            readOnly: true,
            settings: {
              embedding: {
                mode: "platform",
                provider: "openai",
                model: "text-embedding-3-small",
              },
              chunking: { strategy: "recursive", chunkSize: 800, chunkOverlap: 120 },
              retrieval: { mode: "semantic", topK: 5 },
            },
            documentCount: 8,
            characterCount: 4096,
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-07T00:00:00.000Z",
          },
        ],
      }),
    );
    const client = createWorkflowClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.listKnowledgeBases()).resolves.toMatchObject({
      knowledgeBases: [{ id: "kb_customer_support_example", readOnly: true }],
    });
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/api/knowledge-bases", {
      method: "GET",
      credentials: "include",
      headers: undefined,
      body: undefined,
    });
  });

  it("updates knowledge base settings as JSON", async () => {
    const settings = {
      embedding: { mode: "platform", provider: "openai", model: "text-embedding-3-small" },
      chunking: { strategy: "recursive", chunkSize: 800, chunkOverlap: 120 },
      retrieval: { mode: "semantic", topK: 4 },
    } as const;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        knowledgeBase: {
          id: "kb-1",
          name: "客服知识库",
          description: null,
          visibility: "private",
          readOnly: false,
          settings,
          documentCount: 0,
          characterCount: 0,
          createdAt: "2026-06-07T00:00:00.000Z",
          updatedAt: "2026-06-07T00:00:00.000Z",
        },
      }),
    );
    const client = createWorkflowClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await client.updateKnowledgeBase("kb-1", { settings });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/api/knowledge-bases/kb-1",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings }),
      }),
    );
  });

  it("deletes a run by id", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createWorkflowClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.deleteRun("run 1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/api/runs/run%201", {
      method: "DELETE",
      credentials: "include",
      headers: undefined,
      body: undefined,
    });
  });

  it("normalizes HTTP errors with API error bodies", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "not_found",
            message: "Workflow missing was not found.",
          },
        },
        { status: 404 },
      ),
    );
    const client = createWorkflowClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.getWorkflow("missing")).rejects.toMatchObject({
      name: "WorkflowClientError",
      kind: "http",
      status: 404,
      apiError: {
        error: {
          code: "not_found",
        },
      },
    });
  });

  it("normalizes network failures", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    const client = createWorkflowClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.listWorkflows()).rejects.toMatchObject({
      kind: "network",
      message: "Network request failed: offline",
    });
  });

  it("normalizes malformed success responses as schema errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ workflows: [{ id: "" }] }));
    const client = createWorkflowClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.listWorkflows()).rejects.toBeInstanceOf(WorkflowClientError);
    await expect(client.listWorkflows()).rejects.toMatchObject({
      kind: "schema",
    });
  });

  it("integrates with the Hono server app", async () => {
    const app = createServerApp({
      fetch: async () =>
        jsonResponse({
          model: "qwen3.5:0.8b",
          created_at: "2026-06-01T00:00:00.000Z",
          message: { role: "assistant", content: "Client integration output." },
          done: true,
          prompt_eval_count: 5,
          eval_count: 7,
        }),
    });
    const fetchFromApp: typeof fetch = async (input, init) => {
      const url = new URL(input.toString());
      return app.request(`${url.pathname}${url.search}`, init);
    };
    const client = createWorkflowClient({ baseUrl: "http://server.test", fetch: fetchFromApp });

    const created = await client.createRun("client-inline-workflow", {
      input: { topic: "client integration" },
      workflow: createDefaultWorkflow(),
    });
    expect(created.run.status).toBe("running");

    // Poll until the run completes
    let run = created.run;
    for (let i = 0; i < 50 && run.status === "running"; i++) {
      run = (await client.getRun(run.id)).run;
    }
    const events = await client.listRunEvents(run.id);

    expect(run.status).toBe("succeeded");
    expect(events.events.at(-1)?.type).toBe("run.completed");
  });
});
