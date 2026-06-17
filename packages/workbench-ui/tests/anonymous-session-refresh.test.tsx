import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppWorkbench, type WorkbenchWorkflowApi } from "../src";

const sessionState = vi.hoisted(() => ({
  pending: false,
}));

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    useSession: () => ({ data: null, isPending: sessionState.pending }),
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn(),
  }),
}));

describe("anonymous session refresh", () => {
  it("keeps unsaved draft edits when a signed-out session refetch completes", async () => {
    const user = userEvent.setup();
    const api = createServerApiStub();
    const { rerender } = render(<AppWorkbench workflowApi={api} />);

    expect(await screen.findByText("云舵客服 RAG 演示")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("rf__node-start1"));
    await user.clear(screen.getByLabelText("Node label"));
    await user.type(screen.getByLabelText("Node label"), "Edited Start");
    expect(screen.getByLabelText("Node label")).toHaveValue("Edited Start");

    sessionState.pending = true;
    rerender(<AppWorkbench workflowApi={api} />);
    sessionState.pending = false;
    rerender(<AppWorkbench workflowApi={api} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Node label")).toHaveValue("Edited Start");
    });
  });
});

function createServerApiStub(): WorkbenchWorkflowApi {
  return {
    listWorkflows: vi.fn(async () => ({ workflows: [] })),
    createWorkflow: vi.fn(),
    getWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    createRun: vi.fn(),
    listWorkflowRuns: vi.fn(async () => ({ runs: [] })),
    getRun: vi.fn(),
    listRunEvents: vi.fn(async () => ({ events: [] })),
    runStreamUrl: vi.fn((runId: string) => `http://test/api/runs/${runId}/stream`),
    deleteRun: vi.fn(),
    resumeRun: vi.fn(),
    listKnowledgeBases: vi.fn(async () => ({ knowledgeBases: [] })),
    createKnowledgeBase: vi.fn(),
    getKnowledgeBase: vi.fn(),
    updateKnowledgeBase: vi.fn(),
    deleteKnowledgeBase: vi.fn(),
    listKnowledgeBaseDocuments: vi.fn(async () => ({ documents: [] })),
    createTextKnowledgeDocument: vi.fn(),
    createFileKnowledgeDocument: vi.fn(),
    deleteKnowledgeDocument: vi.fn(),
    reindexKnowledgeDocument: vi.fn(),
    listMcpServers: vi.fn(async () => ({ servers: [] })),
    createMcpServer: vi.fn(),
    updateMcpServer: vi.fn(),
    refreshMcpServer: vi.fn(),
    deleteMcpServer: vi.fn(),
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
