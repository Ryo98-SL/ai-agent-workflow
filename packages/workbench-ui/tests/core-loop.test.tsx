import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RunEvent, WorkflowDto, WorkflowRun, WorkflowSummary } from "@ai-agent-workflow/api-contracts";
import { createDefaultWorkflow, type WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it, vi } from "vitest";
import { AppWorkbench, type WorkbenchWorkflowApi } from "../src";

// Treat the workbench as authenticated so it uses the injected server workflow
// API (not the anonymous localStorage adapter).
vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    useSession: () => ({ data: { user: { id: "test-user", email: "test@example.com", name: "Test" } }, isPending: false }),
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn(),
  }),
}));

describe("MVP smoke loop", () => {
  it("edits, runs, saves, reopens, and renders a workflow run", async () => {
    const user = userEvent.setup();
    const { api, workflows, calls } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(screen.queryByText("Untitled Agent Workflow")).not.toBeInTheDocument();
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    expect(screen.getByText("qwen3.5:0.8b")).toBeInTheDocument();
    expect(screen.getByAltText("Ollama")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open model settings" }));
    expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
    // Off-catalog models are added through the custom-model flow rather than by
    // editing a preset model's name in place.
    await user.click(screen.getByRole("button", { name: "Choose model provider and model" }));
    await user.click(screen.getByRole("button", { name: "Add custom model" }));
    await user.type(screen.getByLabelText("Model name"), "deepseek-v4-flash-smoke");
    await user.click(screen.getByRole("button", { name: "Add & use" }));
    // API keys are managed per provider: open the deepseek group's key control,
    // add a labeled key through the modal, and confirm it persists via the API.
    await user.click(screen.getByRole("button", { name: "Choose model provider and model" }));
    await user.click(screen.getByRole("button", { name: "Manage deepseek API keys" }));
    await user.click(screen.getByRole("button", { name: "Add API Key" }));
    await user.type(screen.getByLabelText("Label"), "Primary");
    await user.type(screen.getByLabelText("API Key"), "deepseek-test-key");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(api.createProviderKey).toHaveBeenCalledWith({
      provider: "deepseek",
      label: "Primary",
      apiKey: "deepseek-test-key",
    });
    fireEvent.click(screen.getByText("LLM"));
    expect(screen.getByLabelText("Node label")).toHaveValue("LLM");
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
    expect(screen.getByText("start1.topic")).toBeInTheDocument();
    expect(screen.getByText("resolvable")).toBeInTheDocument();
    // The run trigger is hidden while the inspector occupies the right rail.
    expect(screen.queryByRole("button", { name: "Run workflow" })).not.toBeInTheDocument();
    expect(screen.queryByText("Run Log")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close node inspector" }));
    expect(screen.queryByLabelText("Node label")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run workflow" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run workflow" }));
    expect(await screen.findByText("Run Log")).toBeInTheDocument();
    const runPanel = screen.getByText("Workflow Run").closest("div");
    expect(runPanel).not.toBeNull();
    await user.clear(screen.getByRole("textbox", { name: /Topic/ }));
    await user.type(screen.getByRole("textbox", { name: /Topic/ }), "workbench tests");
    await user.click(screen.getAllByRole("button", { name: "Run workflow" }).at(-1)!);
    expect((await screen.findAllByText("Memory runtime output.")).length).toBeGreaterThan(0);
    expect(api.createRun).toHaveBeenLastCalledWith("workflow-1", {
      input: { topic: "workbench tests" },
      modelProvider: expect.objectContaining({
        model: "deepseek-v4-flash-smoke",
        provider: "deepseek",
      }),
      modelProviderKeys: {},
      // The deepseek key added above is selected; authed runs send only its id.
      providerKeyId: "key-Primary",
    });
    expect(calls.updateWorkflow).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close run log" }));
    fireEvent.click(screen.getByText("LLM"));
    await user.click(screen.getByRole("button", { name: "History" }));
    const inspector = screen.getByRole("complementary");
    expect(within(inspector).getByText("Memory runtime output.")).toBeInTheDocument();
    expect(within(inspector).queryByText(/Run succeeded/)).not.toBeInTheDocument();

    // Saving must not leak the API key into the persisted workflow document.
    const persisted = workflows.get("workflow-1")?.workflow;
    expect(persisted?.settings.modelProvider?.apiKey).toBeUndefined();
    expect(persisted?.settings.modelProviderKeys.deepseek).toBeUndefined();

    // Reopen via the workflow switcher (New/Open/Save-as moved there).
    await user.click(screen.getByRole("button", { name: "Switch workflow" }));
    await user.click(await screen.findByRole("button", { name: "Seed Workflow" }));
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
  });

  it("edits Start fields and prevents adding a second Start node", async () => {
    const user = userEvent.setup();
    const { api } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Start"));
    expect(screen.getByLabelText("Node label")).toHaveValue("Start");
    await user.click(screen.getByRole("button", { name: "Add field" }));
    await user.clear(screen.getAllByRole("textbox", { name: "Name" }).at(-1)!);
    await user.type(screen.getAllByRole("textbox", { name: "Name" }).at(-1)!, "audience");
    expect(screen.getByDisplayValue("audience")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open node palette" }));
    const palette = screen.getByText("Node Palette").closest("aside");
    expect(palette).not.toBeNull();
    expect(within(palette!).getByRole("button", { name: /Start/ })).toBeDisabled();
  });

  it("saves workflow metadata inside the metadata editor without activating header Save", async () => {
    const user = userEvent.setup();
    const { api, workflows, calls } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    const headerSave = screen.getByRole("button", { name: "Save" });
    expect(headerSave).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Switch workflow" }));
    await user.click(screen.getByRole("button", { name: "Edit Seed Workflow workflow details" }));
    await user.click(screen.getByRole("button", { name: "Use bot workflow icon" }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Renamed Workflow");
    expect(headerSave).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save workflow details" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Save workflow details" }));
    await waitFor(() => {
      expect(workflows.get("workflow-1")?.workflow.metadata.name).toBe("Renamed Workflow");
    });
    expect(calls.updateWorkflow).toHaveBeenCalled();
    expect(screen.getAllByText("Renamed Workflow").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Switch workflow" }).querySelector(".lucide-bot")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Edit Renamed Workflow workflow details" }));
    expect(screen.getByRole("button", { name: "Use bot workflow icon" })).toHaveClass("border-brand");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("opens a source-handle palette and connects the source node to the created node", async () => {
    const user = userEvent.setup();
    const { api, workflows, calls } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add connected node from LLM" }));
    const palette = screen.getByText("Node Palette").closest("aside");
    expect(palette).not.toBeNull();
    await user.click(within(palette!).getByRole("button", { name: /Code/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const savedWorkflow = workflows.get("workflow-1")?.workflow;
    expect(calls.updateWorkflow).toHaveBeenCalled();
    expect(savedWorkflow?.graph.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "code1", type: "code" })]));
    expect(savedWorkflow?.graph.edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "llm1", target: "code1" })]),
    );
  });

  it("opens header run history as a read-only debug view without replacing the live run", async () => {
    const user = userEvent.setup();
    const { api } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Run workflow" }));
    expect(await screen.findByText("Run Log")).toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: /Topic/ }));
    await user.type(screen.getByRole("textbox", { name: /Topic/ }), "current live run");
    await user.click(screen.getAllByRole("button", { name: "Run workflow" }).at(-1)!);
    expect(await screen.findByText("Memory runtime output.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close run log" }));

    await api.createRun("workflow-1", { input: { topic: "older header history" } });

    await user.click(screen.getByRole("button", { name: "Run history" }));
    const historyDrawer = await screen.findByRole("complementary", { name: "Run history drawer" });
    await user.click((await within(historyDrawer).findAllByRole("button", { name: /Open run from/i }))[0]);

    expect(within(historyDrawer).getByText(/Historical run from/)).toBeInTheDocument();
    await user.click(await within(historyDrawer).findByRole("button", { name: /LLM/ }));
    expect(within(historyDrawer).getByText("Live output for older header history.")).toBeInTheDocument();
    expect(within(historyDrawer).queryByText("Start Inputs")).not.toBeInTheDocument();
    expect(within(historyDrawer).queryByRole("button", { name: "Run workflow" })).not.toBeInTheDocument();
    await user.click(within(historyDrawer).getAllByRole("button", { name: /Delete run from/i })[0]);
    expect(within(historyDrawer).getByText("Delete this run?")).toBeInTheDocument();
    await user.click(within(historyDrawer).getByRole("button", { name: "Cancel" }));
    expect(within(historyDrawer).queryByText("Delete this run?")).not.toBeInTheDocument();

    await user.click(within(historyDrawer).getByRole("button", { name: "Close run history" }));
    await user.click(screen.getByRole("button", { name: "Run workflow" }));
    const livePanel = await findFloatingPanel("Run Log");
    expect(within(livePanel).getByText("Workflow run")).toBeInTheDocument();
    expect(within(livePanel).getByText("Start Inputs")).toBeInTheDocument();
    await user.click(within(livePanel).getByRole("button", { name: /LLM/ }));
    expect(within(livePanel).getByText("Memory runtime output.")).toBeInTheDocument();
    expect(within(livePanel).queryByText("Live output for older header history.")).not.toBeInTheDocument();
  });

  it("undoes and redoes connected node creation without reverting global model settings", async () => {
    const user = userEvent.setup();
    const { api, workflows } = createMemoryWorkflowApi((workflow) => ({
      ...workflow,
      settings: {
        ...workflow.settings,
        modelProvider: {
          provider: "deepseek",
          baseURL: "https://api.deepseek.com",
          model: "global-model-stays",
        },
        modelProviderKeys: { deepseek: "global-key" },
      },
    }));

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo canvas edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo canvas edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lock canvas" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add connected node from LLM" }));
    const palette = screen.getByText("Node Palette").closest("aside");
    expect(palette).not.toBeNull();
    await user.click(within(palette!).getByRole("button", { name: /Code/ }));
    expect(screen.getByRole("button", { name: "Undo canvas edit" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Undo canvas edit" }));
    expect(screen.getByRole("button", { name: "Redo canvas edit" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(workflows.get("workflow-1")?.workflow.graph.nodes.some((node) => node.id === "code1")).toBe(false);
    expect(workflows.get("workflow-1")?.workflow.settings.modelProvider?.model).toBe("global-model-stays");
    expect(workflows.get("workflow-1")?.workflow.settings.modelProviderKeys.deepseek).toBe("global-key");

    await user.click(screen.getByRole("button", { name: "Redo canvas edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      const savedWorkflow = workflows.get("workflow-1")?.workflow;
      expect(savedWorkflow?.graph.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "code1", type: "code" })]));
      expect(savedWorkflow?.graph.edges).toEqual(
        expect.arrayContaining([expect.objectContaining({ source: "llm1", target: "code1" })]),
      );
      expect(savedWorkflow?.settings.modelProvider?.model).toBe("global-model-stays");
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Undo canvas edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Redo canvas edit" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("highlights directly connected edges when hovering a node", async () => {
    const { api } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();

    const llmNode = screen.getByText("LLM").closest("[data-testid='rf__node-llm1']");
    const edgePath = document.querySelector("[data-testid='rf__edge-edge-start-llm'] .react-flow__edge-path");
    expect(llmNode).not.toBeNull();
    expect(edgePath).not.toBeNull();

    fireEvent.mouseEnter(llmNode!);
    expect(edgePath).toHaveStyle({ stroke: "#10b981", strokeWidth: "2.5" });

    fireEvent.mouseLeave(llmNode!);
    expect(edgePath).not.toHaveStyle({ stroke: "#10b981" });
  });

  it("opens a target-handle palette, disables End, and connects the created node into the target node", async () => {
    const user = userEvent.setup();
    const { api, workflows } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open node palette" }));
    let palette = screen.getByText("Node Palette").closest("aside");
    expect(palette).not.toBeNull();
    await user.click(within(palette!).getByRole("button", { name: /End/ }));
    expect(screen.queryByRole("button", { name: "Add connected node from End" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add connected node into LLM" }));
    palette = screen.getByText("Node Palette").closest("aside");
    expect(palette).not.toBeNull();
    expect(within(palette!).getByRole("button", { name: /End/ })).toBeDisabled();
    await user.click(within(palette!).getByRole("button", { name: /Code/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const savedWorkflow = workflows.get("workflow-1")?.workflow;
    expect(savedWorkflow?.graph.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ id: "code1", type: "code" })]));
    expect(savedWorkflow?.graph.edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "code1", target: "llm1" })]),
    );
  });

  it("shows Ollama model options only when dev providers are enabled", async () => {
    const user = userEvent.setup();
    const { api } = createMemoryWorkflowApi();
    const { unmount } = render(<AppWorkbench workflowApi={api} />);

    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open model settings" }));
    await user.click(screen.getByRole("button", { name: "Choose model provider and model" }));
    expect(screen.getAllByText("deepseek").length).toBeGreaterThan(0);
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.2")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-4-20250514")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Image input").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ollama")).not.toBeInTheDocument();
    unmount();

    const { api: devApi } = createMemoryWorkflowApi();
    render(<AppWorkbench workflowApi={devApi} showDevModelProviders />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open model settings" }));
    await user.click(screen.getByRole("button", { name: "Choose model provider and model" }));
    expect(screen.getAllByText("Ollama").length).toBeGreaterThan(0);
    await user.click(screen.getByText("llama3.2"));
    expect(screen.getByDisplayValue("http://127.0.0.1:11434")).toBeInTheDocument();
  });

  it("selects OpenAI multimodal models and shows icon capability tags", async () => {
    const user = userEvent.setup();
    const { api, workflows } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open model settings" }));
    await user.click(screen.getByRole("button", { name: "Choose model provider and model" }));
    await user.click(screen.getByText("gpt-5.2"));

    expect(screen.getByDisplayValue("https://api.openai.com/v1")).toBeInTheDocument();
    expect(screen.getAllByText("gpt-5.2").length).toBeGreaterThan(0);
    expect(screen.getAllByAltText("OpenAI").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Chat model").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Image input").length).toBeGreaterThan(0);
    await user.click(screen.getByText("Advanced"));
    await user.clear(screen.getByLabelText("Max tokens"));
    await user.type(screen.getByLabelText("Max tokens"), "1600");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(workflows.get("workflow-1")?.workflow.settings.modelProvider).toMatchObject({
      provider: "openai",
      model: "gpt-5.2",
      maxTokens: 1600,
    });
  });

  it("expands matching model groups while searching", async () => {
    const user = userEvent.setup();
    const { api } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open model settings" }));
    await user.click(screen.getByRole("button", { name: "Choose model provider and model" }));
    await user.click(screen.getByRole("button", { name: "OpenAI" }));
    expect(screen.queryByText("gpt-5.2")).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search model"), "gpt-5.2");
    expect(screen.getByText("gpt-5.2")).toBeInTheDocument();
  });

  it("dismisses provider API key popovers when clicking elsewhere in the model selector", async () => {
    const user = userEvent.setup();
    const { api } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open model settings" }));
    await user.click(screen.getByRole("button", { name: "Choose model provider and model" }));
    await user.click(screen.getByRole("button", { name: "Manage deepseek API keys" }));
    expect(screen.getByText("Usage Priority")).toBeInTheDocument();

    await user.click(screen.getByPlaceholderText("Search model"));
    expect(screen.queryByText("Usage Priority")).not.toBeInTheDocument();
  });

  it("shows the LLM node model override on the canvas", async () => {
    const { api } = createMemoryWorkflowApi((workflow) => ({
      ...workflow,
      settings: {
        modelProvider: {
          provider: "deepseek",
          baseURL: "https://api.deepseek.com",
          model: "deepseek-v4-flash",
        },
        modelProviderKeys: {},
        providerKeyPrefs: {},
      },
      graph: {
        ...workflow.graph,
        nodes: workflow.graph.nodes.map((node) =>
          node.type === "llm" ? { ...node, config: { ...node.config, model: "gpt-5.5" } } : node,
        ),
      },
    }));

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.5")).toBeInTheDocument();
    expect(screen.getByAltText("DeepSeek")).toBeInTheDocument();
  });

  it("configures node-level model settings from the LLM inspector", async () => {
    const user = userEvent.setup();
    const { api, workflows } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    fireEvent.click(screen.getByText("LLM"));
    await user.click(screen.getByRole("button", { name: "Open model setting" }));
    await user.click(screen.getByRole("button", { name: "Choose model provider and model" }));
    await user.click(screen.getByText("gpt-5.2"));
    expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
    await user.click(screen.getByText("Advanced"));
    await user.clear(screen.getByLabelText("Max tokens"));
    await user.type(screen.getByLabelText("Max tokens"), "1200");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const savedNode = workflows.get("workflow-1")?.workflow.graph.nodes.find((node) => node.type === "llm");
    expect(savedNode?.type).toBe("llm");
    if (savedNode?.type === "llm") {
      expect(savedNode.config.modelSettings).toMatchObject({
        provider: "openai",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-5.2",
        maxTokens: 1200,
      });
      expect(savedNode.config.modelSettings?.apiKey).toBeUndefined();
    }
  });
});

function createMemoryWorkflowApi(prepareSeed: (workflow: WorkflowFile) => WorkflowFile = (workflow) => workflow) {
  const seed = prepareSeed(createDefaultWorkflow());
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
  const runs = new Map<string, WorkflowRun>();
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
      icon: workflow.metadata.icon,
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
      const runNumber = nextRunNumber;
      const id = `run-${runNumber}`;
      nextRunNumber += 1;
      const topic = typeof request.input?.topic === "string" ? request.input.topic : "";
      const nodeOutput =
        topic === "current live run" || topic === "older header history"
          ? `Live output for ${topic}.`
          : "Memory runtime output.";
      const createdAtMs = Date.UTC(2026, 5, 1, 0, 0, runNumber * 3);
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
            output: node.type === "start" ? "Start inputs materialized." : nodeOutput,
            data: node.type === "start" ? request.input ?? {} : { text: nodeOutput, usage: null, reasoning: null },
          })),
        },
        error: null,
        createdAt: new Date(createdAtMs).toISOString(),
        startedAt: new Date(createdAtMs + 1000).toISOString(),
        completedAt: new Date(createdAtMs + 2000).toISOString(),
      };
      runs.set(id, run);
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
    getRun: vi.fn(async (runId) => {
      const run = runs.get(runId);
      if (!run) throw new Error(`Run ${runId} was not found.`);
      return { run };
    }),
    listRunEvents: vi.fn(async (runId) => ({ events: events.get(runId) ?? [] })),
    listWorkflowRuns: vi.fn(async (workflowId) => ({
      runs: Array.from(runs.values())
        .filter((run) => run.workflowId === workflowId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    })),
    deleteRun: vi.fn(async (runId) => {
      runs.delete(runId);
      events.delete(runId);
    }),
    deleteWorkflow: vi.fn(async () => undefined),
    runStreamUrl: vi.fn((runId) => `http://test/api/runs/${runId}/stream`),
    listProviderKeys: vi.fn(async () => ({ keys: [] })),
    createProviderKey: vi.fn(async (request) => ({
      key: {
        id: `key-${request.label}`,
        provider: request.provider,
        label: request.label,
        last4: request.apiKey.slice(-4),
        hasKey: true as const,
      },
    })),
    deleteProviderKey: vi.fn(async () => undefined),
    listCustomModels: vi.fn(async () => ({ models: [] })),
    createCustomModel: vi.fn(async (request) => ({
      model: { id: "model-test", createdAt: new Date().toISOString(), ...request },
    })),
    deleteCustomModel: vi.fn(async () => undefined),
    getCredits: vi.fn(async () => ({ status: "none" as const })),
    applyCredits: vi.fn(async () => ({ status: "approved" as const, grantedTokens: 100_000, balanceTokens: 100_000 })),
  };

  return { api, workflows, calls };
}

async function findFloatingPanel(title: string) {
  await screen.findByText(title);
  const panel = screen.getByText(title).closest("aside");
  expect(panel).not.toBeNull();
  return panel!;
}
