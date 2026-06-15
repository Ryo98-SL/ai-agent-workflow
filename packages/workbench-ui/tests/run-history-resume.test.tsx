import * as React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RunInterrupt, WorkflowRun } from "@ai-agent-workflow/api-contracts";
import { createSupportBotWithReviewWorkflow } from "@ai-agent-workflow/workflow-domain";
import { WorkbenchDataProvider } from "../src/data/WorkbenchDataProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { RunHistoryMenu } from "../src/workbench/components/RunHistoryMenu";
import type { WorkbenchWorkflowApi } from "../src/workbench/types";

// Monaco does not render in jsdom; node cards transitively import it.
vi.mock("@monaco-editor/react", () => ({
  default: (props: { value?: string }) => React.createElement("pre", { "data-testid": "monaco-json" }, props.value ?? ""),
}));

// Run History requires a session (anonymous runs have no durable history).
vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    useSession: () => ({ data: { user: { id: "u", email: "u@example.com", name: "U" } }, isPending: false }),
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn(),
  }),
}));

const interrupt: RunInterrupt = {
  nodeId: "humanInput1",
  prompt: "请复核草拟回复",
  actions: [
    { id: "approve", label: "通过", value: "approved" },
    { id: "reject", label: "驳回", value: "rejected" },
  ],
  allowTextInput: false,
};

const waitingRun: WorkflowRun = {
  id: "run-1",
  workflowId: "workflow-1",
  status: "waiting_human",
  input: { customerQuestion: "怎么退款" },
  output: {
    summary: "Awaiting human input.",
    nodeResults: [
      { nodeId: "start1", label: "Start", status: "succeeded", output: "" },
      { nodeId: "llm1", label: "LLM", status: "succeeded", output: "草拟回复" },
    ],
  },
  interrupt,
  error: null,
  createdAt: "2026-06-14T00:00:00.000Z",
  startedAt: "2026-06-14T00:00:00.000Z",
  completedAt: null,
};

// What the run looks like after the reviewer approves and the leg finishes: the
// paused node plus the post-HITL End node are now in the merged output.
const succeededRun: WorkflowRun = {
  ...waitingRun,
  status: "succeeded",
  interrupt: null,
  output: {
    summary: "Completed.",
    nodeResults: [
      ...waitingRun.output!.nodeResults,
      { nodeId: "humanInput1", label: "人工复核", status: "succeeded", output: "通过" },
      { nodeId: "endReview", label: "人工已确认", status: "succeeded", output: "回复已发送给客户" },
    ],
  },
  completedAt: "2026-06-14T00:00:05.000Z",
};

function createStub(): { api: WorkbenchWorkflowApi; getResumeCalls: () => number } {
  let current: WorkflowRun = waitingRun;
  const resumeRun = vi.fn(async () => {
    // The HTTP response returns the run set to "running"; the continuation
    // streams asynchronously and the run later resolves to succeeded.
    current = succeededRun;
    return { run: { ...waitingRun, status: "running" as const, interrupt: null } };
  });
  const api = {
    listWorkflows: vi.fn(async () => ({ workflows: [] })),
    createWorkflow: vi.fn(),
    getWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    createRun: vi.fn(),
    listWorkflowRuns: vi.fn(async () => ({ runs: [current] })),
    getRun: vi.fn(async () => ({ run: current })),
    listRunEvents: vi.fn(async () => ({ events: [] })),
    runStreamUrl: vi.fn((runId: string) => `http://test/api/runs/${runId}/stream`),
    deleteRun: vi.fn(async () => undefined),
    resumeRun,
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
  return { api, getResumeCalls: () => resumeRun.mock.calls.length };
}

describe("RunHistoryMenu resume", () => {
  it("resumes a paused run from history, streams the rest, and resolves cards + list status", async () => {
    const user = userEvent.setup();
    const workflow = createSupportBotWithReviewWorkflow();
    const { api, getResumeCalls } = createStub();

    render(
      <ThemeProvider>
        <WorkbenchDataProvider workflowApi={api} apiBaseUrl="http://127.0.0.1:8788">
          <RunHistoryMenu workflow={workflow} workflowId="workflow-1" debugState={{ status: "idle" }} nodeStates={new Map()} />
        </WorkbenchDataProvider>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Run history" }));
    const drawer = await screen.findByRole("complementary", { name: "Run history drawer" });

    // The paused run is auto-selected: the HITL form shows under its node card,
    // the post-HITL node has not run yet, and the list row reads "Waiting".
    expect(await within(drawer).findByText("等待复核")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /通过/ })).toBeInTheDocument();
    expect(within(drawer).queryByText("人工已确认")).not.toBeInTheDocument();
    expect(within(drawer).getByText("Waiting")).toBeInTheDocument();

    await user.click(within(drawer).getByRole("button", { name: /通过/ }));

    // After the resumed leg streams to completion: the form is gone, the run
    // resolves to succeeded, the post-HITL node card appears, and the runs-list
    // row no longer shows the in-progress "Waiting" state.
    await waitFor(() => expect(within(drawer).getByText("Run succeeded")).toBeInTheDocument());
    expect(within(drawer).queryByText("等待复核")).not.toBeInTheDocument();
    expect(within(drawer).getByText("人工已确认")).toBeInTheDocument();
    expect(within(drawer).queryByText("Waiting")).not.toBeInTheDocument();
    expect(getResumeCalls()).toBe(1);
    expect(api.resumeRun).toHaveBeenCalledWith("run-1", { action_id: "approve", action_value: "approved" });
  });
});
