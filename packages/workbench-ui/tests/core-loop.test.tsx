import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RunEvent, WorkflowDto, WorkflowRun, WorkflowSummary } from "@ai-agent-workflow/api-contracts";
import { createDefaultWorkflow, type WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { describe, expect, it, vi } from "vitest";
import { AppWorkbench, type WorkbenchWorkflowApi } from "../src";

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
    await user.type(screen.getByLabelText("Model name"), "-smoke");
    await user.type(screen.getByLabelText("API Key"), "deepseek-test-key");
    fireEvent.click(screen.getByText("LLM"));
    expect(screen.getByText("Node Inspector")).toBeInTheDocument();
    expect(screen.getByDisplayValue("llm1")).toBeInTheDocument();
    expect(screen.getByText("start1.topic")).toBeInTheDocument();
    expect(screen.getByText("resolvable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run workflow" })).toBeInTheDocument();
    expect(screen.queryByText("Run Log")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close node inspector" }));
    expect(screen.queryByText("Node Inspector")).not.toBeInTheDocument();
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
      modelProviderKeys: expect.objectContaining({
        deepseek: "deepseek-test-key",
      }),
    });
    expect(calls.updateWorkflow).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save workflow as" }));
    expect(workflows.size).toBe(2);
    expect(Array.from(workflows.values()).at(-1)?.workflow.settings.modelProvider?.apiKey).toBeUndefined();
    expect(Array.from(workflows.values()).at(-1)?.workflow.settings.modelProviderKeys.deepseek).toBe("deepseek-test-key");

    await user.click(screen.getByRole("button", { name: "Open workflow" }));
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
  });

  it("edits Start fields and prevents adding a second Start node", async () => {
    const user = userEvent.setup();
    const { api } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Start"));
    expect(screen.getByDisplayValue("start1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add field" }));
    await user.clear(screen.getAllByRole("textbox", { name: "Name" }).at(-1)!);
    await user.type(screen.getAllByRole("textbox", { name: "Name" }).at(-1)!, "audience");
    expect(screen.getByDisplayValue("audience")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open node palette" }));
    const palette = screen.getByText("Node Palette").closest("aside");
    expect(palette).not.toBeNull();
    expect(within(palette!).getByRole("button", { name: /Start/ })).toBeDisabled();
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
    const { api } = createMemoryWorkflowApi();

    render(<AppWorkbench workflowApi={api} />);
    expect(await screen.findByText("Seed Workflow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open model settings" }));
    await user.click(screen.getByRole("button", { name: "Choose model provider and model" }));
    await user.click(screen.getByText("gpt-5.2"));

    expect(screen.getByDisplayValue("https://api.openai.com/v1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("gpt-5.2")).toBeInTheDocument();
    expect(screen.getAllByAltText("OpenAI").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Chat model").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Image input").length).toBeGreaterThan(0);
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
    await user.type(screen.getByLabelText("API Key"), "node-openai-key");
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
        apiKey: "node-openai-key",
        maxTokens: 1200,
      });
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
            output: node.type === "start" ? "Start inputs materialized." : "Memory runtime output.",
            data: node.type === "start" ? request.input ?? {} : { text: "Memory runtime output.", usage: null, reasoning: null },
          })),
        },
        error: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        startedAt: "2026-06-01T00:00:01.000Z",
        completedAt: "2026-06-01T00:00:02.000Z",
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
    runStreamUrl: vi.fn((runId) => `http://test/api/runs/${runId}/stream`),
  };

  return { api, workflows, calls };
}
