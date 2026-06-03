import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { Loader2 } from "lucide-react";
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
import type { RunInput } from "@ai-agent-workflow/api-contracts";
import { WorkbenchLayout } from "./components/WorkbenchLayout";
import type { AddNodeOptions, AppWorkbenchProps, DebugState } from "./types";

export function AppWorkbench({ workflowApi, showDevModelProviders = false }: AppWorkbenchProps) {
  const [workflow, setWorkflow] = useState<WorkflowFile>(() => createDefaultWorkflow());
  const [initialLoaded, setInitialLoaded] = useState(false);
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

  const applySavedWorkflowDto = useCallback((dto: WorkflowDto, previousWorkflow: WorkflowFile) => {
    setWorkflow(preserveTransientModelProvider(dto.workflow, previousWorkflow));
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

      applySavedWorkflowDto(response.workflow, workflow);
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
          setInitialLoaded(true);
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
    (type: WorkflowNodeType, options?: AddNodeOptions) => {
      if (type === "start" && workflow.graph.nodes.some((node) => node.type === "start")) {
        setPaletteOpen(false);
        return;
      }

      const anchorNode = options?.sourceNodeId
        ? workflow.graph.nodes.find((node) => node.id === options.sourceNodeId)
        : undefined;
      const position = anchorNode
        ? {
            x: anchorNode.position.x + (options?.handleType === "target" ? -260 : 260),
            y: anchorNode.position.y,
          }
        : { x: 180 + workflow.graph.nodes.length * 32, y: 120 + workflow.graph.nodes.length * 24 };
      const node = createNode(type, position, workflow.graph.nodes);
      const edge = anchorNode ? createConnectedNodeEdge(anchorNode.id, node.id, options?.handleType) : undefined;
      markWorkflow((current) => ({
        ...current,
        graph: {
          ...current.graph,
          nodes: [...current.graph.nodes, node],
          edges: edge ? [...current.graph.edges, edge] : current.graph.edges,
        },
      }));
      setSelectedNodeId(node.id);
      setInspectorOpen(true);
      setDebugOpen(false);
      setPaletteOpen(false);
    },
    [markWorkflow, workflow.graph.nodes],
  );

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setInspectorOpen(true);
    setDebugOpen(false);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedNodeId("");
    setInspectorOpen(false);
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

  const runWorkflow = useCallback(
    async (input: RunInput) => {
      if (debugState.status === "running") {
        return;
      }

      setDebugOpen(true);
      setDebugState({ status: "running" });

      try {
        const persisted = !workflowId || dirty ? await persistWorkflow("save") : { id: workflowId, workflow };
        const runResponse = await workflowApi.createRun(persisted.id, {
          input,
          modelProvider: workflow.settings.modelProvider,
        });
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
    [debugState.status, dirty, errorMessage, persistWorkflow, workflow, workflowApi, workflowId],
  );

  if (!initialLoaded) {
    return <WorkbenchStartupState error={debugState.error} />;
  }

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
      showDevModelProviders={showDevModelProviders}
      onAddNode={addNode}
      onCloseDebug={() => setDebugOpen(false)}
      onCloseInspector={handleCloseInspector}
      onClosePalette={() => setPaletteOpen(false)}
      onCloseSettings={() => setSettingsOpen(false)}
      onNewWorkflow={handleNewWorkflow}
      onOpenWorkflow={handleOpenWorkflow}
      onToggleRunPanel={() => setDebugOpen((state) => !state)}
      onRunWorkflow={runWorkflow}
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

function createConnectedNodeEdge(
  anchorNodeId: string,
  createdNodeId: string,
  handleType: AddNodeOptions["handleType"] = "source",
) {
  const source = handleType === "target" ? createdNodeId : anchorNodeId;
  const target = handleType === "target" ? anchorNodeId : createdNodeId;

  return {
    id: `edge-${source}-${target}-${Date.now()}`,
    source,
    target,
  };
}

function WorkbenchStartupState({ error }: { error?: string }) {
  return (
    <main className="flex h-full min-h-0 items-center justify-center bg-slate-50 p-6 text-slate-950">
      <section className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-5 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-sm font-semibold text-slate-900">Workflow load failed</h1>
            <p className="mt-2 text-sm leading-5 text-rose-600">{error}</p>
          </>
        ) : (
          <>
            <Loader2 size={22} className="mx-auto animate-spin text-slate-500" aria-hidden />
            <h1 className="mt-3 text-sm font-semibold text-slate-900">Loading workflow</h1>
            <p className="mt-2 text-sm leading-5 text-slate-500">Syncing workflow state with the server.</p>
          </>
        )}
      </section>
    </main>
  );
}

function preserveTransientModelProvider(savedWorkflow: WorkflowFile, previousWorkflow: WorkflowFile): WorkflowFile {
  const savedSettings = savedWorkflow.settings.modelProvider;
  const previousSettings = previousWorkflow.settings.modelProvider;

  if (!savedSettings || !previousSettings?.apiKey || savedSettings.provider !== previousSettings.provider) {
    return savedWorkflow;
  }

  return {
    ...savedWorkflow,
    settings: {
      ...savedWorkflow.settings,
      modelProvider: {
        ...savedSettings,
        apiKey: previousSettings.apiKey,
      },
    },
  };
}
