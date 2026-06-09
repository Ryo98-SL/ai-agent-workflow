import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { useWorkflowExecution } from "./hooks/useWorkflowExecution";
import { useWorkflowGraphHistory } from "./hooks/useWorkflowGraphHistory";
import { Loader2 } from "lucide-react";
import {
  createDefaultWorkflow,
  createKnowledgeDemoWorkflow,
  createNode,
  ifElseHandleIds,
  type ModelProvider,
  type ModelProviderKeys,
  type OpenAICompatibleSettings,
  type ProviderKeyPreference,
  parseWorkflowJson,
  serializeWorkflowFile,
  type WorkflowFile,
  type WorkflowNode,
  type WorkflowNodeType,
} from "@ai-agent-workflow/workflow-domain";
import type { WorkflowDto } from "@ai-agent-workflow/api-contracts";
import type { RunInput } from "@ai-agent-workflow/api-contracts";
import { WorkbenchLayout } from "./components/WorkbenchLayout";
import { Toaster } from "../components/ui/sonner";
import { ThemeProvider } from "../theme/ThemeProvider";
import { WorkbenchDataProvider, useWorkbenchData } from "../data/WorkbenchDataProvider";
import { useActiveWorkflowApi } from "../data/useActiveWorkflowApi";
import { useSession } from "../data/useAccount";
import { useProviderKeyStore } from "../data/useProviderKeyStore";
import { useQueryClient } from "@tanstack/react-query";
import type { WorkflowMetaPatch } from "./components/WorkflowMetaEditor";
import { ImportLocalDataPrompt } from "../auth/ImportLocalDataPrompt";
import type { AddNodeOptions, AppWorkbenchProps } from "./types";
import { workflowDirtySnapshot } from "./workflowDirtySnapshot";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8788";

export function AppWorkbench({ apiBaseUrl, ...props }: AppWorkbenchProps) {
  return (
    <ThemeProvider>
      <WorkbenchDataProvider workflowApi={props.workflowApi} apiBaseUrl={apiBaseUrl ?? DEFAULT_API_BASE_URL}>
        <ImportLocalDataPrompt />
        <WorkbenchApp {...props} />
      </WorkbenchDataProvider>
      <Toaster richColors closeButton position="bottom-right" />
    </ThemeProvider>
  );
}

function WorkbenchApp({ showDevModelProviders = false }: AppWorkbenchProps) {
  // Server-backed when signed in, localStorage-backed when anonymous.
  const workflowApi = useActiveWorkflowApi();
  const { data: sessionData, isPending: sessionPending } = useSession();
  // Anonymous visitors land on the runnable RAG demo (seeded example KB) instead
  // of a blank default, so the customer-support flow is discoverable out of box.
  const isAnonymous = !sessionData?.user;
  const providerKeyStore = useProviderKeyStore();
  const { workflowRefreshNonce } = useWorkbenchData();
  const queryClient = useQueryClient();
  const [workflow, setWorkflow] = useState<WorkflowFile>(() => createDefaultWorkflow());
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const { nodeStates, debugState, setDebugState, runWorkflow: execRunWorkflow, resumeRun, newConversation, conversationTurns } =
    useWorkflowExecution(workflowApi);
  const [workflowId, setWorkflowId] = useState<string | undefined>();
  const [savedWorkflowSnapshot, setSavedWorkflowSnapshot] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const { canRedo, canUndo, commitGraphHistoryEntry, redo, resetHistory, undo } = useWorkflowGraphHistory({
    setWorkflow,
  });
  const currentWorkflowSnapshot = useMemo(() => workflowDirtySnapshot(workflow), [workflow]);
  const dirty = savedWorkflowSnapshot !== null && currentWorkflowSnapshot !== savedWorkflowSnapshot;

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
      setSavedWorkflowSnapshot(workflowDirtySnapshot(dto.workflow));
      resetHistory();
      resetSelectionPanels();
    },
    [resetHistory, resetSelectionPanels],
  );

  const applySavedWorkflowDto = useCallback((dto: WorkflowDto, previousWorkflow: WorkflowFile) => {
    const nextWorkflow = preserveTransientModelProvider(dto.workflow, previousWorkflow);
    setWorkflow(nextWorkflow);
    setWorkflowId(dto.id);
    setSavedWorkflowSnapshot(workflowDirtySnapshot(nextWorkflow));
  }, []);

  const errorMessage = useCallback((error: unknown) => {
    return error instanceof Error ? error.message : "Workflow API request failed.";
  }, []);

  const workflowForServer = useCallback((nextWorkflow: WorkflowFile) => {
    const parsed = parseWorkflowJson(serializeWorkflowFile(nextWorkflow));
    return parsed.ok ? parsed.data : nextWorkflow;
  }, []);

  const persistWorkflow = useCallback(
    async (mode: "save" | "saveAs", workflowToPersist: WorkflowFile = workflow): Promise<WorkflowDto> => {
      const payload = workflowForServer(workflowToPersist);
      const response =
        mode === "save" && workflowId
          ? await workflowApi.updateWorkflow(workflowId, { workflow: payload })
          : await workflowApi.createWorkflow({ workflow: payload });

      applySavedWorkflowDto(response.workflow, workflowToPersist);
      return response.workflow;
    },
    [applySavedWorkflowDto, workflow, workflowApi, workflowForServer, workflowId],
  );

  useEffect(() => {
    let cancelled = false;

    // Wait until the session is resolved before bootstrapping. Otherwise the
    // brief "pending" window is treated as anonymous and would persist a junk
    // default workflow to localStorage (re-populating it right after import).
    if (sessionPending) {
      return;
    }

    async function loadInitialWorkflow() {
      setDebugState({ status: "loading" });
      try {
        const list = await workflowApi.listWorkflows();
        const first = list.workflows[0];

        if (first) {
          const response = await workflowApi.getWorkflow(first.id);
          if (!cancelled) {
            applyWorkflowDto(response.workflow);
          }
        } else if (!cancelled) {
          // No workflows yet: show an unsaved draft (workflowId undefined). It is
          // only persisted on the first save/run, so an untouched session leaves
          // nothing behind. Anonymous visitors get the customer-support RAG demo;
          // signed-in users start from the neutral default.
          const nextWorkflow = isAnonymous ? createKnowledgeDemoWorkflow() : createDefaultWorkflow();
          setWorkflow(nextWorkflow);
          setWorkflowId(undefined);
          setSavedWorkflowSnapshot(workflowDirtySnapshot(nextWorkflow));
          resetHistory();
          resetSelectionPanels();
        }

        if (!cancelled) {
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
  }, [applyWorkflowDto, errorMessage, isAnonymous, resetHistory, workflowApi, resetSelectionPanels, sessionPending, workflowRefreshNonce]);

  const markWorkflow = useCallback((updater: SetStateAction<WorkflowFile>) => {
    setWorkflow(updater);
  }, []);

  const updateNode = useCallback(
    (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => {
      markWorkflow((current) => {
        const nodes = current.graph.nodes.map((node) => (node.id === nodeId ? updater(node) : node));
        return {
          ...current,
          graph: {
            ...current.graph,
            nodes,
            // Drop edges whose source handle no longer exists (e.g. an If/Else
            // case was removed), so the graph never carries dangling branches.
            edges: pruneDanglingSourceHandleEdges(nodes, current.graph.edges),
          },
        };
      });
    },
    [markWorkflow],
  );

  const updateModelSettings = useCallback(
    (settings: OpenAICompatibleSettings, providerKeys: ModelProviderKeys) => {
      markWorkflow((current) => ({
        ...current,
        settings: {
          ...current.settings,
          modelProvider: settings,
          modelProviderKeys: providerKeys,
        },
      }));
    },
    [markWorkflow],
  );

  const updateProviderKeyPreference = useCallback(
    (provider: ModelProvider, preference: ProviderKeyPreference) => {
      markWorkflow((current) => ({
        ...current,
        settings: {
          ...current.settings,
          providerKeyPrefs: {
            ...current.settings.providerKeyPrefs,
            [provider]: preference,
          },
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
      const edge = anchorNode
        ? createConnectedNodeEdge(anchorNode.id, node.id, options?.handleType, options?.sourceHandleId)
        : undefined;
      commitGraphHistoryEntry({ type: "addNode", node, edges: edge ? [edge] : [] });
      setSelectedNodeId(node.id);
      setInspectorOpen(true);
      setDebugOpen(false);
      setPaletteOpen(false);
    },
    [commitGraphHistoryEntry, workflow.graph.nodes],
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
    setSavedWorkflowSnapshot(workflowDirtySnapshot(next));
    resetHistory();
  }, [resetHistory, resetSelectionPanels]);

  const invalidateWorkflowList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["workflows"] });
  }, [queryClient]);

  const [pendingSwitch, setPendingSwitch] = useState<{ id: string; name: string } | null>(null);
  const [switching, setSwitching] = useState(false);

  const switchWorkflow = useCallback(
    async (id: string) => {
      if (id === workflowId) return;
      setDebugState({ status: "loading" });
      try {
        const response = await workflowApi.getWorkflow(id);
        applyWorkflowDto(response.workflow);
        setDebugState({ status: "idle" });
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
      }
    },
    [applyWorkflowDto, errorMessage, workflowApi, workflowId],
  );

  // Guard switching when there are unsaved changes: surface the top "Save & switch"
  // bar instead of switching (and discarding) immediately.
  const requestSwitchWorkflow = useCallback(
    (id: string, name: string) => {
      if (id === workflowId) return;
      if (!dirty) {
        void switchWorkflow(id);
        return;
      }
      setPendingSwitch({ id, name });
    },
    [dirty, switchWorkflow, workflowId],
  );

  const cancelPendingSwitch = useCallback(() => setPendingSwitch(null), []);

  const deleteWorkflowById = useCallback(
    async (id: string) => {
      try {
        await workflowApi.deleteWorkflow(id);
        invalidateWorkflowList();
        if (id === workflowId) {
          // Deleted the open workflow — load another, or start a fresh draft.
          const list = await workflowApi.listWorkflows();
          const next = list.workflows[0];
          if (next) {
            const response = await workflowApi.getWorkflow(next.id);
            applyWorkflowDto(response.workflow);
          } else {
            handleNewWorkflow();
          }
        }
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
      }
    },
    [applyWorkflowDto, errorMessage, handleNewWorkflow, invalidateWorkflowList, workflowApi, workflowId],
  );

  const saveWorkflow = useCallback(
    async (mode: "save" | "saveAs", workflowToPersist: WorkflowFile = workflow) => {
      setDebugState({ status: "loading" });
      try {
        await persistWorkflow(mode, workflowToPersist);
        invalidateWorkflowList();
        setDebugState({ status: "idle" });
        return true;
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
        return false;
      }
    },
    [errorMessage, invalidateWorkflowList, persistWorkflow, workflow],
  );

  const confirmPendingSwitch = useCallback(async () => {
    if (!pendingSwitch) return;
    setSwitching(true);
    try {
      const saved = await saveWorkflow("save");
      if (!saved) return;
      await switchWorkflow(pendingSwitch.id);
      setPendingSwitch(null);
    } finally {
      setSwitching(false);
    }
  }, [pendingSwitch, saveWorkflow, switchWorkflow]);

  const saveWorkflowMeta = useCallback(
    async (id: string, patch: WorkflowMetaPatch) => {
      if (id === workflowId) {
        const nextWorkflow = {
          ...workflow,
          metadata: { ...workflow.metadata, ...patch },
        };
        return saveWorkflow("save", nextWorkflow);
      }

      setDebugState({ status: "loading" });
      try {
        const response = await workflowApi.getWorkflow(id);
        const nextWorkflow = {
          ...response.workflow.workflow,
          metadata: { ...response.workflow.workflow.metadata, ...patch },
        };
        await workflowApi.updateWorkflow(id, { workflow: workflowForServer(nextWorkflow) });
        invalidateWorkflowList();
        setDebugState({ status: "idle" });
        return true;
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
        return false;
      }
    },
    [errorMessage, invalidateWorkflowList, saveWorkflow, setDebugState, workflow, workflowApi, workflowForServer, workflowId],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || isWorkflowShortcutEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      if (key === "z") {
        event.preventDefault();
        undo();
        return;
      }

      if (key === "y" && !event.shiftKey) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  // While the Save button is active (unsaved changes exist), warn before the tab
  // closes or navigates away so users don't forget to save. Browsers ignore any
  // custom text and show their own generic confirmation prompt.
  useEffect(() => {
    if (!dirty) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers require a truthy returnValue to trigger the prompt.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const runWorkflow = useCallback(
    async (input: RunInput) => {
      if (debugState.status === "running") {
        return;
      }

      setDebugOpen(true);

      try {
        const persisted = !workflowId || dirty ? await persistWorkflow("save") : { id: workflowId, workflow };

        // Resolve the active stored key for the run's provider. Authed users
        // send only the key id (the server decrypts it); anonymous users inject
        // the in-memory plaintext via the transient key map.
        const provider = workflow.settings.modelProvider?.provider;
        const preference = provider ? workflow.settings.providerKeyPrefs?.[provider] : undefined;
        let modelProviderKeys = workflow.settings.modelProviderKeys;
        let providerKeyId: string | undefined;
        if (preference?.usagePriority === "apiKey" && preference.providerKeyId && provider) {
          if (providerKeyStore.isAnon) {
            const apiKey = providerKeyStore.getApiKey(preference.providerKeyId);
            if (apiKey) {
              modelProviderKeys = { ...modelProviderKeys, [provider]: apiKey };
            }
          } else {
            providerKeyId = preference.providerKeyId;
          }
        }

        execRunWorkflow(persisted.id, {
          input,
          modelProvider: workflow.settings.modelProvider,
          modelProviderKeys,
          providerKeyId,
        });
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
      }
    },
    [
      debugState.status,
      dirty,
      errorMessage,
      execRunWorkflow,
      persistWorkflow,
      providerKeyStore,
      setDebugState,
      workflow,
      workflowId,
    ],
  );

  const closeDebug = useCallback(() => {
    setDebugOpen(false);
  }, []);

  const toggleRunPanel = useCallback(() => {
    setDebugOpen((state) => !state);
  }, []);

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
      nodeStates={nodeStates}
      paletteOpen={paletteOpen}
      settingsOpen={settingsOpen}
      inspectorOpen={inspectorOpen}
      debugOpen={debugOpen}
      showDevModelProviders={showDevModelProviders}
      onAddNode={addNode}
      onCloseDebug={closeDebug}
      onCloseInspector={handleCloseInspector}
      canRedo={canRedo}
      canUndo={canUndo}
      onClosePalette={() => setPaletteOpen(false)}
      onCloseSettings={() => setSettingsOpen(false)}
      onCommitGraphHistoryEntry={commitGraphHistoryEntry}
      onRedo={redo}
      onToggleRunPanel={toggleRunPanel}
      onRunWorkflow={runWorkflow}
      onResumeRun={resumeRun}
      onNewConversation={newConversation}
      conversationTurns={conversationTurns}
      onSwitchWorkflow={requestSwitchWorkflow}
      pendingSwitchName={pendingSwitch?.name ?? null}
      switching={switching}
      onConfirmSwitch={confirmPendingSwitch}
      onCancelSwitch={cancelPendingSwitch}
      onCreateWorkflow={handleNewWorkflow}
      onDeleteWorkflow={deleteWorkflowById}
      onSaveWorkflowMeta={saveWorkflowMeta}
      onSaveWorkflow={() => saveWorkflow("save")}
      onSelectNode={handleSelectNode}
      onTogglePalette={() => setPaletteOpen((current) => !current)}
      onToggleSettings={() => setSettingsOpen((current) => !current)}
      onUndo={undo}
      onUpdateModelSettings={updateModelSettings}
      onUpdateProviderKeyPreference={updateProviderKeyPreference}
      onUpdateNode={updateNode}
    />
  );
}

function isWorkflowShortcutEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable || target.closest("[contenteditable='true']")) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  const role = target.getAttribute("role");
  return role === "textbox" || role === "combobox" || role === "searchbox";
}

/**
 * Removes edges that leave a multi-output node through a source handle that no
 * longer exists (currently only If/Else cases). Edges without a `sourceHandle`,
 * or from single-output nodes, are always kept.
 */
function pruneDanglingSourceHandleEdges(
  nodes: WorkflowNode[],
  edges: WorkflowFile["graph"]["edges"],
): WorkflowFile["graph"]["edges"] {
  const validHandlesByNode = new Map<string, Set<string>>();
  for (const node of nodes) {
    if (node.type === "ifElse") {
      validHandlesByNode.set(node.id, new Set(ifElseHandleIds(node)));
    }
  }

  return edges.filter((edge) => {
    if (!edge.sourceHandle) {
      return true;
    }
    const validHandles = validHandlesByNode.get(edge.source);
    return !validHandles || validHandles.has(edge.sourceHandle);
  });
}

function createConnectedNodeEdge(
  anchorNodeId: string,
  createdNodeId: string,
  handleType: AddNodeOptions["handleType"] = "source",
  sourceHandleId?: string,
) {
  const source = handleType === "target" ? createdNodeId : anchorNodeId;
  const target = handleType === "target" ? anchorNodeId : createdNodeId;

  return {
    id: `edge-${source}-${target}-${Date.now()}`,
    source,
    target,
    // Preserve which branch handle the edge leaves from (e.g. If/Else cases).
    // Only meaningful when connecting *from* the anchor's source handle.
    ...(handleType !== "target" && sourceHandleId ? { sourceHandle: sourceHandleId } : {}),
  };
}

function WorkbenchStartupState({ error }: { error?: string }) {
  return (
    <main className="flex h-full min-h-0 items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-sm rounded-md border border-border bg-card p-5 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-sm font-semibold text-foreground">Workflow load failed</h1>
            <p className="mt-2 text-sm leading-5 text-destructive">{error}</p>
          </>
        ) : (
          <>
            <Loader2 size={22} className="mx-auto animate-spin text-muted-foreground" aria-hidden />
            <h1 className="mt-3 text-sm font-semibold text-foreground">Loading workflow</h1>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">Syncing workflow state with the server.</p>
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
