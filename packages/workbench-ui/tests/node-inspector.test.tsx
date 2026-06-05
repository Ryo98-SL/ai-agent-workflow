import { render, screen } from "@testing-library/react";
import { createDefaultWorkflow } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it, vi } from "vitest";
import { WorkbenchDataProvider } from "../src/data/WorkbenchDataProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { NodeInspector } from "../src/workbench/components/NodeInspector";
import type { DebugState, NodeExecutionState, WorkbenchWorkflowApi } from "../src/workbench/types";

describe("NodeInspector", () => {
  it("locks Settings and opens History while a workflow is running", () => {
    const workflow = createDefaultWorkflow();
    const selectedNode = workflow.graph.nodes.find((node) => node.type === "llm");
    expect(selectedNode).toBeDefined();

    const nodeStates = new Map<string, NodeExecutionState>([
      [
        "llm1",
        {
          nodeId: "llm1",
          nodeType: "llm",
          status: "running",
          startedAt: Date.UTC(2026, 5, 5, 9, 30, 0),
          streamingText: "Streaming output",
        },
      ],
    ]);
    const debugState: DebugState = { status: "running" };

    render(
      <ThemeProvider>
        <WorkbenchDataProvider workflowApi={createWorkflowApiStub()} apiBaseUrl="http://127.0.0.1:8788">
          <NodeInspector
            workflow={workflow}
            workflowId="workflow-1"
            selectedNode={selectedNode}
            debugState={debugState}
            nodeStates={nodeStates}
            updateNode={vi.fn()}
          />
        </WorkbenchDataProvider>
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Settings" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "History" })).toBeEnabled();
    expect(screen.queryByText("Model Setting")).not.toBeInTheDocument();
    expect(screen.getByText("Streaming output")).toBeInTheDocument();
  });
});

function createWorkflowApiStub(): WorkbenchWorkflowApi {
  return {
    listWorkflows: vi.fn(async () => ({ workflows: [] })),
    createWorkflow: vi.fn(),
    getWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    createRun: vi.fn(),
    listWorkflowRuns: vi.fn(async () => ({ runs: [] })),
    getRun: vi.fn(),
    listRunEvents: vi.fn(),
    runStreamUrl: vi.fn(),
    listProviderKeys: vi.fn(async () => ({ keys: [] })),
    putProviderKey: vi.fn(),
    deleteProviderKey: vi.fn(),
    listCustomModels: vi.fn(async () => ({ models: [] })),
    createCustomModel: vi.fn(),
    deleteCustomModel: vi.fn(),
  } as unknown as WorkbenchWorkflowApi;
}
