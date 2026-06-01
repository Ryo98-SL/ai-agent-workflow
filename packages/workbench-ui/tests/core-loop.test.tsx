import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RunEvent, WorkflowDto, WorkflowRun, WorkflowSummary } from "@ai-agent-workflow/api-contracts";
import { createDefaultWorkflow, type WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it, vi } from "vitest";
import { AppWorkbench, type WorkbenchWorkflowApi } from "../src";

describe("MVP smoke loop", () => {
  it("creates, edits, runs, saves, reopens, and renders a server mock run", async () => {
    const user = userEvent.setup();
    const { api, workflows, calls } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open model settings" }));
    await user.type(screen.getByPlaceholderText("gpt-4.1-mini"), "-smoke");
    fireEvent.click(screen.getByText("LLM"));
    expect(screen.getByText("Node Inspector")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
    expect(screen.queryByText("Run Log")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close node inspector" }));
    expect(screen.queryByText("Node Inspector")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("LLM"));
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("Run Log")).toBeInTheDocument();
    expect(await screen.findByText("Mock LLM output for LLM.")).toBeInTheDocument();
    expect(calls.updateWorkflow).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save workflow as" }));
    expect(workflows.size).toBe(2);
    expect(Array.from(workflows.values()).at(-1)?.workflow.settings.modelProvider?.apiKey).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Open workflow" }));
    fireEvent.click(await screen.findByText("Current Time"));
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect((await screen.findAllByText("Mock tool output for Current Time.")).length).toBeGreaterThan(0);
  });
});

function createMemoryWorkflowApi() {
  const seed = createDefaultWorkflow();
  const workflows = new Map<string, WorkflowDto>([
    [
      "workflow-1",
      {
        id: "workflow-1",
        workflow: {
          ...seed,
          metadata: {
            ...seed.metadata,
            name: "Seed Workflow",
          },
        },
      },
    ],
  ]);
  const events = new Map<string, RunEvent[]>();
  let nextWorkflowNumber = 2;
  let nextRunNumber = 1;
  const calls = {
    updateWorkflow: vi.fn(),
  };

  const summaries = (): WorkflowSummary[] =>
    Array.from(workflows.values()).map(({ id, workflow }) => ({
      id,
      name: workflow.metadata.name,
      description: workflow.metadata.description,
      updatedAt: workflow.metadata.updatedAt,
      nodeCount: workflow.graph.nodes.length,
      edgeCount: workflow.graph.edges.length,
    }));

  const clone = (workflow: WorkflowFile): WorkflowFile => JSON.parse(JSON.stringify(workflow)) as WorkflowFile;

  const api: WorkbenchWorkflowApi = {
    listWorkflows: vi.fn(async () => ({ workflows: summaries() })),
    createWorkflow: vi.fn(async (request = {}) => {
      const id = `workflow-${nextWorkflowNumber}`;
      nextWorkflowNumber += 1;
      const workflow = clone(request.workflow ?? createDefaultWorkflow());
      const dto = { id, workflow };
      workflows.set(id, dto);
      return { workflow: dto };
    }),
    getWorkflow: vi.fn(async (id) => {
      const workflow = workflows.get(id);
      if (!workflow) {
        throw new Error(`Workflow ${id} was not found.`);
      }
      return { workflow };
    }),
    updateWorkflow: vi.fn(async (id, request) => {
      calls.updateWorkflow();
      const dto = { id, workflow: clone(request.workflow) };
      workflows.set(id, dto);
      return { workflow: dto };
    }),
    createRun: vi.fn(async (workflowId, request = {}) => {
      const workflow = workflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} was not found.`);
      }
      const id = `run-${nextRunNumber}`;
      nextRunNumber += 1;
      const run: WorkflowRun = {
        id,
        workflowId,
        status: "succeeded",
        input: request.input ?? {},
        output: {
          summary: `Mock run completed for workflow ${workflow.workflow.metadata.name}.`,
          nodeResults: workflow.workflow.graph.nodes.map((node) => ({
            nodeId: node.id,
            label: node.label,
            status: "succeeded",
            output: node.type === "tool" ? `Mock tool output for ${node.label}.` : `Mock LLM output for ${node.label}.`,
          })),
        },
        error: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        startedAt: "2026-06-01T00:00:01.000Z",
        completedAt: "2026-06-01T00:00:02.000Z",
      };
      events.set(id, [
        {
          id: `${id}-event-1`,
          runId: id,
          sequence: 0,
          type: "run.created",
          message: `Run ${id} created.`,
          createdAt: run.createdAt,
        },
      ]);
      return { run };
    }),
    listRunEvents: vi.fn(async (runId) => ({ events: events.get(runId) ?? [] })),
  };

  return { api, workflows, calls };
}
