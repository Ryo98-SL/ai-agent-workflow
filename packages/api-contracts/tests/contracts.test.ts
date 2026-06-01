import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it } from "vitest";
import {
  CreateRunResponseSchema,
  CreateWorkflowRequestSchema,
  ListWorkflowsResponseSchema,
  apiPaths,
  createApiErrorResponse,
} from "@ai-agent-workflow/api-contracts";

describe("api contracts", () => {
  it("builds encoded REST paths", () => {
    expect(apiPaths.workflows()).toBe("/api/workflows");
    expect(apiPaths.workflow("workflow 1")).toBe("/api/workflows/workflow%201");
    expect(apiPaths.workflowRuns("workflow/1")).toBe("/api/workflows/workflow%2F1/runs");
    expect(apiPaths.run("run 1")).toBe("/api/runs/run%201");
    expect(apiPaths.runEvents("run/1")).toBe("/api/runs/run%2F1/events");
  });

  it("accepts a workflow create payload using the domain schema", () => {
    const payload = { workflow: createDefaultWorkflow() };

    expect(CreateWorkflowRequestSchema.parse(payload).workflow?.version).toBe("1");
  });

  it("validates workflow summaries", () => {
    const response = {
      workflows: [
        {
          id: "workflow-1",
          name: "Demo",
          updatedAt: "2026-06-01T00:00:00.000Z",
          nodeCount: 2,
          edgeCount: 1,
        },
      ],
    };

    expect(ListWorkflowsResponseSchema.parse(response).workflows).toHaveLength(1);
  });

  it("validates deterministic run responses", () => {
    const response = {
      run: {
        id: "run-1",
        workflowId: "workflow-1",
        status: "succeeded",
        input: { topic: "contracts" },
        output: {
          summary: "Mock run completed for workflow Demo.",
          nodeResults: [
            {
              nodeId: "start-1",
              label: "Start",
              status: "succeeded",
              output: "Start completed.",
            },
          ],
        },
        error: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        startedAt: "2026-06-01T00:00:01.000Z",
        completedAt: "2026-06-01T00:00:02.000Z",
      },
    };

    expect(CreateRunResponseSchema.parse(response).run.status).toBe("succeeded");
  });

  it("creates normalized API errors", () => {
    expect(createApiErrorResponse("not_found", "Missing workflow")).toEqual({
      error: {
        code: "not_found",
        message: "Missing workflow",
      },
    });
  });
});
