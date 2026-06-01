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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflow }),
      }),
    );
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
    const app = createServerApp();
    const fetchFromApp: typeof fetch = async (input, init) => {
      const url = new URL(input.toString());
      return app.request(`${url.pathname}${url.search}`, init);
    };
    const client = createWorkflowClient({ baseUrl: "http://server.test", fetch: fetchFromApp });

    const workflows = await client.listWorkflows();
    const run = await client.createRun(workflows.workflows[0].id, { input: { topic: "client integration" } });
    const events = await client.listRunEvents(run.run.id);

    expect(run.run.status).toBe("succeeded");
    expect(events.events.at(-1)?.type).toBe("run.completed");
  });
});
