import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
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
import { WorkbenchLayout } from "./components/WorkbenchLayout";
import type { AppWorkbenchProps, DebugState } from "./types";

export function AppWorkbench({ workflowApi }: AppWorkbenchProps) {
  const [workflow, setWorkflow] = useState<WorkflowFile>(() => createDefaultWorkflow());
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [debugState, setDebugState] = useState<DebugState>({ status: "idle" });
  const [workflowId, setWorkflowId] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  const selectedNode = useMemo(
    () => workflow.graph.nodes.find((node) => node.id === selectedNodeId),
    [selectedNodeId, workflow.graph.nodes],
  );

  const resetSelectionPanels = useCallback(() => {
    setSelectedNodeId("");
    setInspectorOpen(false);
    setDebugOpen(false);
  }, []);

  const applyWorkflowDto = useCallback(
    (dto: WorkflowDto) => {
      setWorkflow(dto.workflow);
      setWorkflowId(dto.id);
      setDirty(false);
      resetSelectionPanels();
    },
    [resetSelectionPanels],
  );

  const applySavedWorkflowDto = useCallback((dto: WorkflowDto) => {
    setWorkflow(dto.workflow);
    setWorkflowId(dto.id);
    setDirty(false);
  }, []);

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

      applySavedWorkflowDto(response.workflow);
      return response.workflow;
    },
    [applySavedWorkflowDto, workflow, workflowApi, workflowForServer, workflowId],
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
      setInspectorOpen(true);
      setDebugOpen(false);
      setPaletteOpen(false);
    },
    [markWorkflow, workflow.graph.nodes.length],
  );

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setInspectorOpen(true);
    setDebugOpen(false);
  }, []);

  const handleNewWorkflow = useCallback(() => {
    const next = createDefaultWorkflow();
    setWorkflow(next);
    resetSelectionPanels();
    setDebugState({ status: "idle" });
    setWorkflowId(undefined);
    setDirty(false);
  }, [resetSelectionPanels]);

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

      setDebugOpen(true);
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
    <WorkbenchLayout
      workflow={workflow}
      workflowId={workflowId}
      dirty={dirty}
      selectedNode={selectedNode}
      selectedNodeId={selectedNodeId}
      debugState={debugState}
      paletteOpen={paletteOpen}
      settingsOpen={settingsOpen}
      inspectorOpen={inspectorOpen}
      debugOpen={debugOpen}
      onAddNode={addNode}
      onCloseDebug={() => setDebugOpen(false)}
      onCloseInspector={() => setInspectorOpen(false)}
      onClosePalette={() => setPaletteOpen(false)}
      onCloseSettings={() => setSettingsOpen(false)}
      onNewWorkflow={handleNewWorkflow}
      onOpenWorkflow={handleOpenWorkflow}
      onRunSelectedNode={runSelectedNode}
      onSaveWorkflow={() => saveWorkflow("save")}
      onSaveWorkflowAs={() => saveWorkflow("saveAs")}
      onSelectNode={handleSelectNode}
      onTogglePalette={() => setPaletteOpen((current) => !current)}
      onToggleSettings={() => setSettingsOpen((current) => !current)}
      onUpdateModelSettings={updateModelSettings}
      onUpdateNode={updateNode}
      onWorkflowChange={markWorkflow}
    />
  );
}
