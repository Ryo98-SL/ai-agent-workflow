import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { I18nProvider, useTranslation } from "@ai-agent-workflow/i18n";
import { toast } from "sonner";
import { useWorkflowExecution } from "./hooks/useWorkflowExecution";
import { useWorkflowGraphHistory } from "./hooks/useWorkflowGraphHistory";
import { Loader2 } from "lucide-react";
import {
  cloneNode,
  createDefaultWorkflow,
  createKnowledgeDemoWorkflow,
  createNode,
  ifElseHandleIds,
  resolveToolDescriptor,
  type WorkflowTemplate,
  type MemorySummarySettings,
  type ModelProvider,
  type ModelProviderKeys,
  type OpenAICompatibleSettings,
  type ProviderKeyPreference,
  type WorkflowMode,
  parseWorkflowJson,
  serializeWorkflowFile,
  type WorkflowFile,
  type WorkflowNode,
  type WorkflowNodeType,
} from "@ai-agent-workflow/workflow-domain";
import type { WorkflowDto } from "@ai-agent-workflow/api-contracts";
import type { RunInput } from "@ai-agent-workflow/api-contracts";
import { WorkbenchLayout } from "./components/WorkbenchLayout";
import { WorkflowGraphProvider } from "./components/WorkflowGraphContext";
import { isWorkflowCanvasFocus, isWorkflowShortcutEditableTarget } from "./shortcutFocus";
import { getWorkflowNodeHandles, getWorkflowNodeSize } from "./components/workflowNodes";
import { NewWorkflowDialog } from "./components/NewWorkflowDialog";
import { DEFAULT_MODEL_SETTINGS } from "./components/ModelSettingsPanel";
import { getProviderOption } from "./components/modelCatalog";
import { Toaster } from "../components/ui/sonner";
import { ThemeProvider } from "../theme/ThemeProvider";
import { WorkbenchDataProvider, useWorkbenchData } from "../data/WorkbenchDataProvider";
import { useActiveWorkflowApi } from "../data/useActiveWorkflowApi";
import { useSession } from "../data/useAccount";
import { useProviderKeyStore } from "../data/useProviderKeyStore";
import { useQueryClient } from "@tanstack/react-query";
import type { WorkflowMetaPatch } from "./components/WorkflowMetaEditor";
import { ImportLocalDataPrompt } from "../auth/ImportLocalDataPrompt";
import { workbenchI18nResources, WORKBENCH_I18N_NAMESPACE } from "../i18n";
import type { AddNodeOptions, AppWorkbenchProps, ToolIdentity, WorkflowNodeAction } from "./types";
import { workflowDirtySnapshot } from "./workflowDirtySnapshot";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8788";
const DRAFT_WORKFLOW_SESSION_KEY = "__draft__";

/**
 * Binds a freshly-created Tool node to the tool chosen in the Tool Browser
 * (config from the descriptor's defaults). Non-tool nodes / no-binding pass through.
 */
function bindToolNode(node: WorkflowNode, tool?: ToolIdentity): WorkflowNode {
  if (node.type !== "tool" || !tool) {
    return node;
  }
  const descriptor = resolveToolDescriptor(tool);
  if (!descriptor) {
    return node;
  }
  return {
    ...node,
    label: descriptor.label,
    config: {
      provider: descriptor.provider,
      providerId: descriptor.providerId,
      toolName: descriptor.toolName,
      params: structuredClone(descriptor.defaultParams),
    },
  };
}

export function AppWorkbench({ apiBaseUrl, ...props }: AppWorkbenchProps) {
  return (
    <I18nProvider resources={workbenchI18nResources} defaultNamespace={WORKBENCH_I18N_NAMESPACE}>
      <ThemeProvider>
        <WorkbenchDataProvider workflowApi={props.workflowApi} apiBaseUrl={apiBaseUrl ?? DEFAULT_API_BASE_URL}>
          <ImportLocalDataPrompt />
          <WorkbenchApp {...props} />
        </WorkbenchDataProvider>
        <Toaster richColors closeButton position="bottom-right" />
      </ThemeProvider>
    </I18nProvider>
  );
}

function WorkbenchApp({ showDevModelProviders = false, initialWorkflowId, onWorkflowIdChange, homeHref = "/" }: AppWorkbenchProps) {
  const { t } = useTranslation("workbench");
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
  const authSourceKey = sessionData?.user?.id ? `user:${sessionData.user.id}` : "anonymous";
  const bootstrapKey = `${authSourceKey}:${workflowRefreshNonce}`;
  const loadedBootstrapRef = useRef<{ key: string; workflowApi: typeof workflowApi } | null>(null);
  const {
    nodeStates,
    debugState,
    setDebugState,
    runWorkflow: execRunWorkflow,
    sendChatMessage: execSendChatMessage,
    transcript,
    resumeRun,
    newConversation,
    conversationTurns,
    activateWorkflowSession,
    prepareWorkflowSessionSwitch,
    moveActiveWorkflowSession,
    resetWorkflowSession,
  } = useWorkflowExecution(workflowApi);
  const [workflowId, setWorkflowId] = useState<string | undefined>();
  const [savedWorkflowSnapshot, setSavedWorkflowSnapshot] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  // Lifted so the active Debug Panel sub-route survives panel close/reopen.
  const [debugView, setDebugView] = useState<"input" | "run">("input");
  const debugViewRef = useRef<"input" | "run">("input");
  const debugViewByWorkflowRef = useRef<Map<string, "input" | "run">>(new Map());
  const activeDebugViewKeyRef = useRef(DRAFT_WORKFLOW_SESSION_KEY);
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

  useEffect(() => {
    debugViewRef.current = debugView;
  }, [debugView]);

  const persistActiveDebugView = useCallback(() => {
    debugViewByWorkflowRef.current.set(activeDebugViewKeyRef.current, debugViewRef.current);
  }, []);

  const activateWorkflowDebugView = useCallback(
    (sessionKey: string) => {
      persistActiveDebugView();
      activeDebugViewKeyRef.current = sessionKey;
      const nextView = debugViewByWorkflowRef.current.get(sessionKey) ?? "input";
      debugViewRef.current = nextView;
      setDebugView(nextView);
    },
    [persistActiveDebugView],
  );

  const moveActiveWorkflowDebugView = useCallback(
    (sessionKey: string) => {
      const currentKey = activeDebugViewKeyRef.current;
      debugViewByWorkflowRef.current.set(sessionKey, debugViewRef.current);
      if (currentKey !== sessionKey) {
        debugViewByWorkflowRef.current.delete(currentKey);
      }
      activeDebugViewKeyRef.current = sessionKey;
      debugViewRef.current = debugViewByWorkflowRef.current.get(sessionKey) ?? debugViewRef.current;
    },
    [],
  );

  const applyWorkflowDto = useCallback(
    (dto: WorkflowDto) => {
      activateWorkflowSession(dto.id);
      activateWorkflowDebugView(dto.id);
      setWorkflow(dto.workflow);
      setWorkflowId(dto.id);
      onWorkflowIdChange?.(dto.id);
      setSavedWorkflowSnapshot(workflowDirtySnapshot(dto.workflow));
      resetHistory();
      resetSelectionPanels();
    },
    [activateWorkflowDebugView, activateWorkflowSession, onWorkflowIdChange, resetHistory, resetSelectionPanels],
  );

  const applySavedWorkflowDto = useCallback(
    (dto: WorkflowDto, previousWorkflow: WorkflowFile) => {
      const nextWorkflow = preserveTransientModelProvider(dto.workflow, previousWorkflow);
      moveActiveWorkflowSession(dto.id);
      moveActiveWorkflowDebugView(dto.id);
      setWorkflow(nextWorkflow);
      setWorkflowId(dto.id);
      onWorkflowIdChange?.(dto.id);
      setSavedWorkflowSnapshot(workflowDirtySnapshot(nextWorkflow));
    },
    [moveActiveWorkflowDebugView, moveActiveWorkflowSession, onWorkflowIdChange],
  );

  const errorMessage = useCallback((error: unknown) => {
    return error instanceof Error ? error.message : t("app.workflowApiFailed");
  }, [t]);

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

    if (
      loadedBootstrapRef.current?.key === bootstrapKey &&
      loadedBootstrapRef.current.workflowApi === workflowApi
    ) {
      return;
    }

    async function loadInitialWorkflow() {
      setDebugState({ status: "loading" });
      try {
        const list = await workflowApi.listWorkflows();
        const first =
          (initialWorkflowId ? list.workflows.find((item) => item.id === initialWorkflowId) : undefined) ??
          list.workflows[0];

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
          resetWorkflowSession(DRAFT_WORKFLOW_SESSION_KEY);
          activateWorkflowSession(DRAFT_WORKFLOW_SESSION_KEY);
          activateWorkflowDebugView(DRAFT_WORKFLOW_SESSION_KEY);
          setWorkflow(nextWorkflow);
          setWorkflowId(undefined);
          onWorkflowIdChange?.(undefined);
          setSavedWorkflowSnapshot(workflowDirtySnapshot(nextWorkflow));
          resetHistory();
          resetSelectionPanels();
        }

        if (!cancelled) {
          loadedBootstrapRef.current = { key: bootstrapKey, workflowApi };
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
  }, [
    activateWorkflowDebugView,
    activateWorkflowSession,
    applyWorkflowDto,
    errorMessage,
    bootstrapKey,
    isAnonymous,
    initialWorkflowId,
    onWorkflowIdChange,
    resetHistory,
    resetSelectionPanels,
    resetWorkflowSession,
    sessionPending,
    setDebugState,
    workflowApi,
    workflowRefreshNonce,
  ]);

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

  const setWorkflowMode = useCallback(
    (mode: WorkflowMode) => {
      markWorkflow((current) => ({ ...current, metadata: { ...current.metadata, mode } }));
    },
    [markWorkflow],
  );

  const updateMemorySummary = useCallback(
    (summary: MemorySummarySettings) => {
      markWorkflow((current) => ({
        ...current,
        settings: {
          ...current.settings,
          memory: { ...current.settings.memory, summary },
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

      // Edge Insert: splice the new node onto an existing edge as one atomic step.
      const insert = options?.insertOnEdge;
      if (insert) {
        const sourceNode = workflow.graph.nodes.find((node) => node.id === insert.sourceNodeId);
        const targetNode = workflow.graph.nodes.find((node) => node.id === insert.targetNodeId);
        const removedEdge = workflow.graph.edges.find((edge) => edge.id === insert.edgeId);
        if (!sourceNode || !targetNode || !removedEdge) {
          return;
        }

        const node = bindToolNode(createNode(type, { x: 0, y: 0 }, workflow.graph.nodes), options?.tool);
        const size = getWorkflowNodeSize(node);
        node.position = {
          x: (sourceNode.position.x + targetNode.position.x) / 2 - size.width / 2,
          y: (sourceNode.position.y + targetNode.position.y) / 2 - size.height / 2,
        };

        // Single-output nodes splice through (source → N → target); multi-output
        // nodes (If/Else) only wire the input and leave the target dangling.
        const sourceHandles = getWorkflowNodeHandles(node).filter((handle) => handle.type === "source");
        const isSingleOutput = sourceHandles.length === 1 && sourceHandles[0].id == null;
        const addedEdges = [
          createConnectedNodeEdge(sourceNode.id, node.id, "source", insert.sourceHandleId),
          ...(isSingleOutput ? [createConnectedNodeEdge(node.id, targetNode.id, "source")] : []),
        ];

        commitGraphHistoryEntry({ type: "insertNodeOnEdge", node, addedEdges, removedEdge });
        setSelectedNodeId(node.id);
        setInspectorOpen(true);
        setDebugOpen(false);
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
        : options?.position ?? { x: 180 + workflow.graph.nodes.length * 32, y: 120 + workflow.graph.nodes.length * 24 };
      const node = bindToolNode(createNode(type, position, workflow.graph.nodes), options?.tool);
      // Cursor-follow placement passes the point the node should center on, so
      // shift the freshly created node from its top-left origin to that center.
      if (!anchorNode && options?.position) {
        const size = getWorkflowNodeSize(node);
        node.position = { x: options.position.x - size.width / 2, y: options.position.y - size.height / 2 };
      }
      const edge = anchorNode
        ? createConnectedNodeEdge(anchorNode.id, node.id, options?.handleType, options?.sourceHandleId)
        : undefined;
      commitGraphHistoryEntry({ type: "addNode", node, edges: edge ? [edge] : [] });
      setSelectedNodeId(node.id);
      setInspectorOpen(true);
      setDebugOpen(false);
      setPaletteOpen(false);
    },
    [commitGraphHistoryEntry, workflow.graph.edges, workflow.graph.nodes],
  );

  // Cursor-follow placement (left palette only): a node type is "armed" and a
  // ghost follows the cursor until the user clicks the canvas to commit it.
  const [placementNodeType, setPlacementNodeType] = useState<WorkflowNodeType | null>(null);
  // Tool binding carried alongside an armed cursor-follow placement (left palette).
  const [placementTool, setPlacementTool] = useState<ToolIdentity | null>(null);

  const beginNodePlacement = useCallback((type: WorkflowNodeType, tool?: ToolIdentity) => {
    setPlacementNodeType(type);
    setPlacementTool(tool ?? null);
    setPaletteOpen(false);
  }, []);

  const cancelNodePlacement = useCallback(() => {
    setPlacementNodeType(null);
    setPlacementTool(null);
  }, []);

  const confirmNodePlacement = useCallback(
    (position: { x: number; y: number }) => {
      if (placementNodeType) {
        addNode(placementNodeType, { position, tool: placementTool ?? undefined });
        setPlacementNodeType(null);
        setPlacementTool(null);
      }
    },
    [addNode, placementNodeType, placementTool],
  );

  const togglePalette = useCallback(() => {
    // While placement is armed, the "+" button cancels it instead of reopening.
    if (placementNodeType) {
      setPlacementNodeType(null);
      setPlacementTool(null);
      return;
    }
    setPaletteOpen((current) => !current);
  }, [placementNodeType]);

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setInspectorOpen(true);
    setDebugOpen(false);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedNodeId("");
    setInspectorOpen(false);
  }, []);

  // Node card actions (three-dot menu + ⌘C/⌘V/⌘D shortcuts). The clipboard is a
  // ref — copying shouldn't re-render, and it survives across selection changes.
  // Start nodes are excluded everywhere: a workflow must always have exactly one.
  const clipboardRef = useRef<WorkflowNode | null>(null);

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const source = workflow.graph.nodes.find((node) => node.id === nodeId);
      if (!source || source.type === "start") {
        return;
      }
      const clone = cloneNode(source, workflow.graph.nodes);
      commitGraphHistoryEntry({ type: "addNode", node: clone, edges: [] });
      setSelectedNodeId(clone.id);
      setInspectorOpen(true);
      setDebugOpen(false);
    },
    [commitGraphHistoryEntry, workflow.graph.nodes],
  );

  const copyNode = useCallback(
    (nodeId: string) => {
      const source = workflow.graph.nodes.find((node) => node.id === nodeId);
      if (!source || source.type === "start") {
        return;
      }
      clipboardRef.current = structuredClone(source);
      toast.success(`Copied "${source.label}"`);
    },
    [workflow.graph.nodes],
  );

  const pasteNode = useCallback(() => {
    const source = clipboardRef.current;
    if (!source || source.type === "start") {
      return;
    }
    const clone = cloneNode(source, workflow.graph.nodes);
    commitGraphHistoryEntry({ type: "addNode", node: clone, edges: [] });
    setSelectedNodeId(clone.id);
    setInspectorOpen(true);
    setDebugOpen(false);
  }, [commitGraphHistoryEntry, workflow.graph.nodes]);

  const deleteNode = useCallback(
    (nodeId: string) => {
      const node = workflow.graph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node || node.type === "start") {
        return;
      }
      const edges = workflow.graph.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
      commitGraphHistoryEntry({ type: "removeNodes", nodes: [node], edges });
      if (selectedNodeId === nodeId) {
        handleCloseInspector();
      }
    },
    [commitGraphHistoryEntry, handleCloseInspector, selectedNodeId, workflow.graph.edges, workflow.graph.nodes],
  );

  const handleNodeAction = useCallback(
    (nodeId: string, action: WorkflowNodeAction) => {
      if (action === "copy") {
        copyNode(nodeId);
      } else if (action === "duplicate") {
        duplicateNode(nodeId);
      } else if (action === "delete") {
        deleteNode(nodeId);
      }
    },
    [copyNode, deleteNode, duplicateNode],
  );

  // Loads a workflow as a fresh unsaved draft (canvas + panels reset).
  const loadWorkflowDraft = useCallback(
    (next: WorkflowFile) => {
      resetWorkflowSession(DRAFT_WORKFLOW_SESSION_KEY);
      activateWorkflowSession(DRAFT_WORKFLOW_SESSION_KEY);
      activateWorkflowDebugView(DRAFT_WORKFLOW_SESSION_KEY);
      setWorkflow(next);
      resetSelectionPanels();
      setWorkflowId(undefined);
      onWorkflowIdChange?.(undefined);
      setSavedWorkflowSnapshot(workflowDirtySnapshot(next));
      resetHistory();
    },
    [
      activateWorkflowDebugView,
      activateWorkflowSession,
      onWorkflowIdChange,
      resetHistory,
      resetSelectionPanels,
      resetWorkflowSession,
    ],
  );

  // Blank fallback (e.g. after deleting the last workflow) — no picker.
  const handleNewWorkflow = useCallback(() => {
    loadWorkflowDraft(createDefaultWorkflow());
  }, [loadWorkflowDraft]);

  const [newWorkflowDialogOpen, setNewWorkflowDialogOpen] = useState(false);
  const openNewWorkflowDialog = useCallback(() => setNewWorkflowDialogOpen(true), []);
  const handleSelectTemplate = useCallback(
    (template: WorkflowTemplate) => {
      loadWorkflowDraft(template.build());
      setNewWorkflowDialogOpen(false);
    },
    [loadWorkflowDraft],
  );

  const invalidateWorkflowList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["workflows"] });
  }, [queryClient]);

  const [pendingSwitch, setPendingSwitch] = useState<{ id: string; name: string } | null>(null);
  const [switching, setSwitching] = useState(false);

  const switchWorkflow = useCallback(
    async (id: string) => {
      if (id === workflowId) return;
      prepareWorkflowSessionSwitch();
      persistActiveDebugView();
      setDebugState({ status: "loading" });
      try {
        const response = await workflowApi.getWorkflow(id);
        applyWorkflowDto(response.workflow);
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
      }
    },
    [applyWorkflowDto, errorMessage, persistActiveDebugView, prepareWorkflowSessionSwitch, setDebugState, workflowApi, workflowId],
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
    [applyWorkflowDto, errorMessage, handleNewWorkflow, invalidateWorkflowList, setDebugState, workflowApi, workflowId],
  );

  const saveWorkflow = useCallback(
    async (mode: "save" | "saveAs", workflowToPersist: WorkflowFile = workflow) => {
      try {
        await persistWorkflow(mode, workflowToPersist);
        invalidateWorkflowList();
        return true;
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
        return false;
      }
    },
    [errorMessage, invalidateWorkflowList, persistWorkflow, setDebugState, workflow],
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
        return;
      }

      // Node card actions only fire when the canvas (not a side panel like the
      // Node Inspector) holds focus, so ⌘C/⌘V inside the inspector do a native
      // text copy/paste instead of cloning the selected node.
      if (!isWorkflowCanvasFocus(event.target)) {
        return;
      }

      // Node card actions. Copy/Duplicate act on the selected node; Paste needs a
      // filled clipboard. Each guards on its own precondition so the browser's
      // native ⌘C/⌘V still works when no node is involved.
      if (key === "c" && selectedNodeId) {
        event.preventDefault();
        copyNode(selectedNodeId);
        return;
      }

      if (key === "v" && clipboardRef.current) {
        event.preventDefault();
        pasteNode();
        return;
      }

      if (key === "d" && selectedNodeId) {
        event.preventDefault();
        duplicateNode(selectedNodeId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copyNode, duplicateNode, pasteNode, redo, selectedNodeId, undo]);

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

  // Persists (if needed) and resolves the run's provider credentials. Shared by
  // one-shot runs and Chat Mode sends so both go through the same key resolution.
  const prepareRun = useCallback(async () => {
    const persisted = !workflowId || dirty ? await persistWorkflow("save") : { id: workflowId, workflow };
    const runWorkflow = workflowForRunRequest(persisted.workflow, showDevModelProviders);
    const runModelProvider = modelProviderForRunRequest(workflow.settings.modelProvider, showDevModelProviders);

    // Resolve the active stored key for the run's provider. Authed users send
    // only the key id (the server decrypts it); anonymous users inject the
    // in-memory plaintext via the transient key map.
    const provider = runModelProvider?.provider;
    const preference = provider ? workflow.settings.providerKeyPrefs?.[provider] : undefined;
    let modelProviderKeys = runWorkflow.settings.modelProviderKeys;
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

    return {
      id: persisted.id,
      extras: {
        workflow: runWorkflow,
        modelProvider: runModelProvider,
        modelProviderKeys,
        providerKeyId,
      },
    };
  }, [dirty, persistWorkflow, providerKeyStore, showDevModelProviders, workflow, workflowId]);

  const runWorkflow = useCallback(
    async (input: RunInput) => {
      if (debugState.status === "running") {
        return;
      }
      setDebugOpen(true);
      try {
        const { id, extras } = await prepareRun();
        execRunWorkflow(id, { input, ...extras });
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
      }
    },
    [debugState.status, errorMessage, execRunWorkflow, prepareRun, setDebugState],
  );

  const sendChatMessage = useCallback(
    async (query: string, baseInput: Record<string, string>) => {
      if (debugState.status === "running") {
        return;
      }
      setDebugOpen(true);
      try {
        const { id, extras } = await prepareRun();
        execSendChatMessage(id, query, baseInput, extras);
      } catch (error) {
        setDebugState({ status: "error", error: errorMessage(error) });
      }
    },
    [debugState.status, errorMessage, execSendChatMessage, prepareRun, setDebugState],
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
    <WorkflowGraphProvider
      nodes={workflow.graph.nodes}
      edges={workflow.graph.edges}
      chatMode={workflow.metadata.mode === "chat"}
    >
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
      debugView={debugView}
      onDebugViewChange={setDebugView}
      showDevModelProviders={showDevModelProviders}
      onAddNode={addNode}
      placementNodeType={placementNodeType}
      onBeginNodePlacement={beginNodePlacement}
      onConfirmNodePlacement={confirmNodePlacement}
      onCancelNodePlacement={cancelNodePlacement}
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
      transcript={transcript}
      onSendChatMessage={sendChatMessage}
      onSetWorkflowMode={setWorkflowMode}
      onMemorySummaryChange={updateMemorySummary}
      onSwitchWorkflow={requestSwitchWorkflow}
      pendingSwitchName={pendingSwitch?.name ?? null}
      switching={switching}
      onConfirmSwitch={confirmPendingSwitch}
      onCancelSwitch={cancelPendingSwitch}
      onCreateWorkflow={openNewWorkflowDialog}
      onDeleteWorkflow={deleteWorkflowById}
      onSaveWorkflowMeta={saveWorkflowMeta}
      onSaveWorkflow={() => saveWorkflow("save")}
      onNodeAction={handleNodeAction}
      onSelectNode={handleSelectNode}
      onTogglePalette={togglePalette}
      onToggleSettings={() => setSettingsOpen((current) => !current)}
      onUndo={undo}
      onUpdateModelSettings={updateModelSettings}
      onUpdateProviderKeyPreference={updateProviderKeyPreference}
      onUpdateNode={updateNode}
      homeHref={homeHref}
    />
    <NewWorkflowDialog
      open={newWorkflowDialogOpen}
      onOpenChange={setNewWorkflowDialogOpen}
      onSelect={handleSelectTemplate}
    />
    </WorkflowGraphProvider>
  );
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

function isHiddenDevProvider(provider: ModelProvider | undefined, showDevModelProviders: boolean): boolean {
  return Boolean(provider && getProviderOption(provider)?.devOnly && !showDevModelProviders);
}

function modelProviderForRunRequest(
  settings: OpenAICompatibleSettings | undefined,
  showDevModelProviders: boolean,
): OpenAICompatibleSettings | undefined {
  return isHiddenDevProvider(settings?.provider, showDevModelProviders) ? DEFAULT_MODEL_SETTINGS : settings;
}

function workflowForRunRequest(workflow: WorkflowFile, showDevModelProviders: boolean): WorkflowFile {
  if (showDevModelProviders) {
    return workflow;
  }

  const workflowProviderHidden = isHiddenDevProvider(workflow.settings.modelProvider?.provider, showDevModelProviders);
  let changed = workflowProviderHidden;
  const nodes = workflow.graph.nodes.map((node) => {
    if (node.type !== "llm" && node.type !== "agent") {
      return node;
    }

    const nodeProviderHidden = isHiddenDevProvider(node.config.modelSettings?.provider, showDevModelProviders);
    const inheritedHiddenProviderModel = workflowProviderHidden && Boolean(node.config.model);
    if (!nodeProviderHidden && !inheritedHiddenProviderModel) {
      return node;
    }

    changed = true;
    if (node.type === "llm") {
      return {
        ...node,
        config: {
          ...node.config,
          model: undefined,
          modelSettings: DEFAULT_MODEL_SETTINGS,
        },
      };
    }
    return {
      ...node,
      config: {
        ...node.config,
        model: undefined,
        modelSettings: DEFAULT_MODEL_SETTINGS,
      },
    };
  });

  if (!changed) {
    return workflow;
  }

  return {
    ...workflow,
    graph: {
      ...workflow.graph,
      nodes,
    },
    settings: {
      ...workflow.settings,
      modelProvider: workflowProviderHidden ? DEFAULT_MODEL_SETTINGS : workflow.settings.modelProvider,
    },
  };
}

function WorkbenchStartupState({ error }: { error?: string }) {
  const { t } = useTranslation("workbench");

  return (
    <main className="flex h-full min-h-0 items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-sm rounded-md border border-border bg-card p-5 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-sm font-semibold text-foreground">{t("app.loadFailed")}</h1>
            <p className="mt-2 text-sm leading-5 text-destructive">{error}</p>
          </>
        ) : (
          <>
            <Loader2 size={22} className="mx-auto animate-spin text-muted-foreground" aria-hidden />
            <h1 className="mt-3 text-sm font-semibold text-foreground">{t("app.loadingWorkflow")}</h1>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{t("app.syncingWorkflow")}</p>
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
