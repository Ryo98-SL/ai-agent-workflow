import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDefaultWorkflow, createNode } from "@ai-agent-workflow/workflow-domain";
import type { WorkflowRun } from "@ai-agent-workflow/api-contracts";
import { describe, expect, it, vi } from "vitest";
import { WorkbenchDataProvider } from "../src/data/WorkbenchDataProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { NodeInspector } from "../src/workbench/components/NodeInspector";
import type { DebugState, NodeExecutionState, WorkbenchWorkflowApi } from "../src/workbench/types";

// Monaco does not render text in jsdom; stand in a plain <pre> so run-history
// JSON payloads are assertable.
vi.mock("@monaco-editor/react", () => ({
  default: (props: { value?: string }) =>
    React.createElement("pre", { "data-testid": "monaco-json" }, props.value ?? ""),
}));

// Treat the workbench as authenticated so run-history reads use the injected
// server stub instead of the anonymous local adapter.
vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    useSession: () => ({ data: { user: { id: "test-user", email: "test@example.com", name: "Test" } }, isPending: false }),
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn(),
  }),
}));

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

  it("edits Knowledge node retrieval settings and shows output variables", async () => {
    const workflow = createDefaultWorkflow();
    const knowledge = createNode("knowledge", { x: 360, y: 120 }, workflow.graph.nodes);
    if (knowledge.type !== "knowledge") throw new Error("Expected knowledge node.");
    knowledge.id = "knowledge1";
    knowledge.config = { ...knowledge.config, knowledgeBaseIds: ["kb_customer_support_example"] };
    workflow.graph.nodes = [workflow.graph.nodes[0], knowledge];
    workflow.graph.edges = [{ id: "edge-start-knowledge", source: "start1", target: "knowledge1" }];
    const updateNode = vi.fn((nodeId: string, updater) => {
      const current = workflow.graph.nodes.find((node) => node.id === nodeId);
      if (current) updater(current);
    });

    render(
      <ThemeProvider>
        <WorkbenchDataProvider workflowApi={createWorkflowApiStub()} apiBaseUrl="http://127.0.0.1:8788">
          <NodeInspector
            workflow={workflow}
            workflowId="workflow-1"
            selectedNode={knowledge}
            debugState={{ status: "idle" }}
            nodeStates={new Map()}
            updateNode={updateNode}
          />
        </WorkbenchDataProvider>
      </ThemeProvider>,
    );

    expect(await screen.findByText("云舵客服知识库")).toBeInTheDocument();
    expect(screen.getByText("Output Variables")).toBeInTheDocument();
    expect(screen.getByText("result")).toBeInTheDocument();
    expect(screen.getByText("context")).toBeInTheDocument();

    // The Query Template now renders in the rich-text variable editor.
    expect(screen.getByLabelText("Query Template")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Top K"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Min Score"), { target: { value: "0.5" } });

    expect(updateNode).toHaveBeenCalled();
    await waitFor(() => {
      expect(updateNode.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("renders Knowledge node output data (result, context, query) in run history", async () => {
    const user = userEvent.setup();
    const workflow = createDefaultWorkflow();
    const knowledge = createNode("knowledge", { x: 360, y: 120 }, workflow.graph.nodes);
    if (knowledge.type !== "knowledge") throw new Error("Expected knowledge node.");
    knowledge.id = "knowledge1";
    knowledge.config = { ...knowledge.config, knowledgeBaseIds: ["kb_customer_support_example"] };
    workflow.graph.nodes = [workflow.graph.nodes[0], knowledge];
    workflow.graph.edges = [{ id: "edge-start-knowledge", source: "start1", target: "knowledge1" }];

    const run: WorkflowRun = {
      id: "run-1",
      workflowId: "workflow-1",
      status: "succeeded",
      input: { customerQuestion: "怎么退款" },
      output: {
        summary: "ok",
        nodeResults: [
          {
            nodeId: "knowledge1",
            label: "Knowledge",
            status: "succeeded",
            output: "【资料 1】退款说明",
            data: {
              result: [
                {
                  content: "购买后 7 天内可申请退款。",
                  title: "退款说明",
                  url: null,
                  icon: null,
                  metadata: {
                    knowledgeBaseId: "kb_customer_support_example",
                    documentId: "doc-1",
                    chunkId: "chunk-1",
                    score: 0.91,
                  },
                  files: [],
                },
              ],
              context: "【资料 1】退款说明\n购买后 7 天内可申请退款。",
              query: "怎么退款",
            },
          },
        ],
      },
      error: null,
      createdAt: "2026-06-07T00:00:00.000Z",
      startedAt: "2026-06-07T00:00:01.000Z",
      completedAt: "2026-06-07T00:00:02.000Z",
    };

    const api = createWorkflowApiStub();
    api.listWorkflowRuns = vi.fn(async () => ({ runs: [run] }));

    render(
      <ThemeProvider>
        <WorkbenchDataProvider workflowApi={api} apiBaseUrl="http://127.0.0.1:8788">
          <NodeInspector
            workflow={workflow}
            workflowId="workflow-1"
            selectedNode={knowledge}
            debugState={{ status: "idle" }}
            nodeStates={new Map()}
            updateNode={vi.fn()}
          />
        </WorkbenchDataProvider>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByText("Out Data")).toBeInTheDocument();
    const viewers = await screen.findAllByTestId("monaco-json");
    const combined = viewers.map((viewer) => viewer.textContent ?? "").join("\n");
    expect(combined).toContain('"result"');
    expect(combined).toContain('"context"');
    expect(combined).toContain('"query"');
    expect(combined).toContain("怎么退款");
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
    deleteRun: vi.fn(),
    resumeRun: vi.fn(),
    listKnowledgeBases: vi.fn(async () => ({
      knowledgeBases: [
        {
          id: "kb_customer_support_example",
          name: "云舵客服知识库",
          description: "匿名演示用中文客服知识库。",
          visibility: "example",
          readOnly: true,
          settings: {
            embedding: { mode: "platform", provider: "openai", model: "text-embedding-3-small" },
            chunking: { strategy: "recursive", chunkSize: 800, chunkOverlap: 120 },
            retrieval: { mode: "semantic", topK: 5 },
          },
          documentCount: 1,
          characterCount: 120,
          createdAt: "2026-06-07T00:00:00.000Z",
          updatedAt: "2026-06-07T00:00:00.000Z",
        },
      ],
    })),
    createKnowledgeBase: vi.fn(),
    getKnowledgeBase: vi.fn(),
    updateKnowledgeBase: vi.fn(),
    deleteKnowledgeBase: vi.fn(),
    listKnowledgeBaseDocuments: vi.fn(async () => ({ documents: [] })),
    createTextKnowledgeDocument: vi.fn(),
    createFileKnowledgeDocument: vi.fn(),
    deleteKnowledgeDocument: vi.fn(),
    reindexKnowledgeDocument: vi.fn(),
    listProviderKeys: vi.fn(async () => ({ keys: [] })),
    createProviderKey: vi.fn(),
    deleteProviderKey: vi.fn(),
    listCustomModels: vi.fn(async () => ({ models: [] })),
    createCustomModel: vi.fn(),
    deleteCustomModel: vi.fn(),
    getCredits: vi.fn(async () => ({ status: "none" as const })),
    applyCredits: vi.fn(),
  } as unknown as WorkbenchWorkflowApi;
}
