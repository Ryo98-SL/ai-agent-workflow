import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { FilePlus2 } from "lucide-react";
import {
  createDefaultWorkflow,
  createNode,
  type OpenAICompatibleSettings,
  parseWorkflowJson,
  serializeWorkflowFile,
  type WorkflowFile,
  type WorkflowNode,
  type WorkflowNodeType,
} from "@ai-agent-workflow/workflow-domain";
import type { WorkflowDto } from "@ai-agent-workflow/api-contracts";
import { DebugPanel } from "./components/DebugPanel";
import { ModelSettingsPanel } from "./components/ModelSettingsPanel";
import { NodeInspector } from "./components/NodeInspector";
import { NodePalette } from "./components/NodePalette";
import { ProjectFileActions } from "./components/ProjectFileActions";
import { WorkflowCanvas } from "./components/WorkflowCanvas";
import type { AppWorkbenchProps, DebugState } from "./types";

export function AppWorkbench({ workflowApi }: AppWorkbenchProps) {
  const [workflow, setWorkflow] = useState<WorkflowFile>(() => createDefaultWorkflow());
  const [selectedNodeId, setSelectedNodeId] = useState<string>("llm-1");
  const [debugState, setDebugState] = useState<DebugState>({ status: "idle" });
  const [workflowId, setWorkflowId] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);

  const selectedNode = useMemo(
    () => workflow.graph.nodes.find((node) => node.id === selectedNodeId),
    [selectedNodeId, workflow.graph.nodes],
  );

  const selectFirstUsefulNode = useCallback((nextWorkflow: WorkflowFile) => {
    setSelectedNodeId(nextWorkflow.graph.nodes.find((node) => node.type === "llm")?.id || nextWorkflow.graph.nodes[0]?.id || "");
  }, []);

  const applyWorkflowDto = useCallback(
    (dto: WorkflowDto) => {
      setWorkflow(dto.workflow);
      setWorkflowId(dto.id);
      setDirty(false);
      selectFirstUsefulNode(dto.workflow);
    },
    [selectFirstUsefulNode],
  );

  const errorMessage = useCallback((error: unknown) => {
    return error instanceof Error ? error.message : "Workflow API request failed.";
  }, []);

  const workflowForServer = useCallback((nextWorkflow: WorkflowFile) => {
    const parsed = parseWorkflowJson(serializeWorkflowFile(nextWorkflow));
    return parsed.ok ? parsed.data : nextWorkflow;
  }, []);

  const persistWorkflow = useCallback(
    async (mode: "save" | "saveAs"): Promise<WorkflowDto> => {
      const payload = workflowForServer(workflow);
      const response =
        mode === "save" && workflowId
          ? await workflowApi.updateWorkflow(workflowId, { workflow: payload })
          : await workflowApi.createWorkflow({ workflow: payload });

      applyWorkflowDto(response.workflow);
      return response.workflow;
    },
    [applyWorkflowDto, workflow, workflowApi, workflowForServer, workflowId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialWorkflow() {
      setDebugState({ status: "loading" });
      try {
        const list = await workflowApi.listWorkflows();
        const first = list.workflows[0];
        const response = first
          ? await workflowApi.getWorkflow(first.id)
          : await workflowApi.createWorkflow({ workflow: workflowForServer(createDefaultWorkflow()) });

        if (!cancelled) {
          applyWorkflowDto(response.workflow);
          setDebugState({ status: "idle" });
        }
      } catch (error) {
        if (!cancelled) {
          setDebugState({ status: "error", error: errorMessage(error) });
        }
      }
    }

    void loadInitialWorkflow();

    return () => {
      cancelled = true;
    };
  }, [applyWorkflowDto, errorMessage, workflowApi, workflowForServer]);

  const markWorkflow = useCallback((updater: SetStateAction<WorkflowFile>) => {
    setWorkflow(updater);
    setDirty(true);
  }, []);

  const updateNode = useCallback(
    (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => {
      markWorkflow((current) => ({
        ...current,
        graph: {
          ...current.graph,
          nodes: current.graph.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
        },
      }));
    },
    [markWorkflow],
  );

  const updateModelSettings = useCallback(
    (settings: OpenAICompatibleSettings) => {
      markWorkflow((current) => ({
        ...current,
        settings: {
          ...current.settings,
          modelProvider: settings,
        },
      }));
    },
    [markWorkflow],
  );

  const addNode = useCallback(
    (type: WorkflowNodeType) => {
      const position = { x: 180 + workflow.graph.nodes.length * 32, y: 120 + workflow.graph.nodes.length * 24 };
      const node = createNode(type, position);
      markWorkflow((current) => ({
        ...current,
        graph: { ...current.graph, nodes: [...current.graph.nodes, node] },
      }));
      setSelectedNodeId(node.id);
    },
    [markWorkflow, workflow.graph.nodes.length],
  );

  const handleNewWorkflow = useCallback(() => {
    const next = createDefaultWorkflow();
    setWorkflow(next);
    selectFirstUsefulNode(next);
    setDebugState({ status: "idle" });
    setWorkflowId(undefined);
    setDirty(false);
  }, [selectFirstUsefulNode]);

  const handleOpenWorkflow = useCallback(async () => {
    setDebugState({ status: "loading" });
    try {
      const list = await workflowApi.listWorkflows();
      const first = list.workflows[0];
      if (!first) {
        const created = await workflowApi.createWorkflow({ workflow: workflowForServer(createDefaultWorkflow()) });
        applyWorkflowDto(created.workflow);
      } else {
        const response = await workflowApi.getWorkflow(first.id);
        applyWorkflowDto(response.workflow);
      }
      setDebugState({ status: "idle" });
    } catch (error) {
      setDebugState({ status: "error", error: errorMessage(error) });
    }
  }, [applyWorkflowDto, errorMessage, workflowApi, workflowForServer]);

  const saveWorkflow = useCallback(
    async (mode: "save" | "saveAs") => {
      setDebugState({ status: "loading" });
      try {
        await persistWorkflow(mode);
        setDebugState({ status: "idle" });
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
      }
    },
    [errorMessage, persistWorkflow],
  );

  const runSelectedNode = useCallback(
    async (testVariables: Record<string, string>) => {
      if (!selectedNode || debugState.status === "running") {
        return;
      }

      setDebugState({ status: "running" });

      try {
        const persisted = !workflowId || dirty ? await persistWorkflow("save") : { id: workflowId, workflow };
        const runResponse = await workflowApi.createRun(persisted.id, { input: testVariables });
        const eventResponse = await workflowApi.listRunEvents(runResponse.run.id);

        setDebugState({
          status: runResponse.run.status === "failed" ? "error" : "success",
          result: {
            run: runResponse.run,
            events: eventResponse.events,
          },
        });
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
      }
    },
    [debugState.status, dirty, errorMessage, persistWorkflow, selectedNode, workflow, workflowApi, workflowId],
  );

  return (
    <main className="grid h-full min-h-[760px] grid-cols-[260px_minmax(520px,1fr)_360px] grid-rows-[64px_minmax(0,1fr)_260px] bg-slate-50 text-slate-950">
      <header className="col-span-3 flex items-center gap-3 border-b border-slate-200 bg-white px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white">
          <FilePlus2 size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{workflow.metadata.name}</h1>
          <p className="truncate text-xs text-slate-500">
            {workflowId ? `Server workflow: ${workflowId}` : "Unsaved server workflow"} {dirty ? "• unsaved changes" : ""}
          </p>
        </div>
        <ProjectFileActions
          dirty={dirty}
          filePath={workflowId}
          onNew={handleNewWorkflow}
          onOpen={handleOpenWorkflow}
          onSave={() => saveWorkflow("save")}
          onSaveAs={() => saveWorkflow("saveAs")}
        />
      </header>

      <aside className="row-span-2 border-r border-slate-200 bg-white">
        <NodePalette onAddNode={addNode} />
      </aside>

      <section className="min-w-0 border-r border-slate-200">
        <WorkflowCanvas
          workflow={workflow}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onWorkflowChange={markWorkflow}
        />
      </section>

      <aside className="min-w-0 overflow-y-auto bg-white">
        <ModelSettingsPanel settings={workflow.settings.modelProvider} onChange={updateModelSettings} />
        <NodeInspector selectedNode={selectedNode} updateNode={updateNode} />
      </aside>

      <section className="col-span-2 min-h-0 border-t border-slate-200 bg-white">
        <DebugPanel selectedNode={selectedNode} debugState={debugState} onRun={runSelectedNode} />
      </section>
    </main>
  );
}
