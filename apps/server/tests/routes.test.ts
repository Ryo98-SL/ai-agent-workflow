import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it } from "vitest";
import { createServerApp } from "@ai-agent-workflow/server";

async function json(response: Response) {
  return response.json() as Promise<unknown>;
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

  it("creates deterministic mock runs and events", async () => {
    const app = createServerApp();
    const createRunResponse = await app.request("/api/workflows/workflow-1/runs", {
      method: "POST",
      body: JSON.stringify({ input: { topic: "server tests" } }),
    });

    expect(createRunResponse.status).toBe(201);
    const createdRun = (await json(createRunResponse)) as {
      run: {
        id: string;
        status: string;
        output: { nodeResults: unknown[] };
      };
    };

    expect(createdRun.run.id).toBe("run-1");
    expect(createdRun.run.status).toBe("succeeded");
    expect(createdRun.run.output.nodeResults).toHaveLength(3);

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
      "node.completed",
      "run.completed",
    ]);
  });
});
