import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { nodeTypeLabel, resolveLLMModelSettings } from "@ai-agent-workflow/workflow-domain";
import type { WorkflowEdge, WorkflowFile, WorkflowNode, WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import {
  workflowNodeIconBackgroundClassNames,
  workflowNodeIconClassName,
  workflowNodeIcons,
} from "./workflowNodes/workflowNodeVisuals";
import type { WorkflowGraphHistoryEntry } from "../hooks/useWorkflowGraphHistory";
import type { AddNodeOptions, NodeExecutionState, WorkflowNodeActionHandler } from "../types";
import { useTheme } from "../../theme/ThemeProvider";
import { InlineNodePalettePopover, type InlineNodePaletteState } from "./InlineNodePalettePopover";
import {
  CodeWorkflowNode,
  EndWorkflowNode,
  HumanInputWorkflowNode,
  IfElseWorkflowNode,
  KnowledgeWorkflowNode,
  LlmWorkflowNode,
  StartWorkflowNode,
  TemplateWorkflowNode,
  ToolWorkflowNode,
  getWorkflowNodeHandles,
  getWorkflowNodeSize,
  type OpenWorkflowNodePalette,
  type WorkflowReactNode,
} from "./workflowNodes";
import { WorkflowCanvasControls } from "./WorkflowCanvasControls";

type WorkflowCanvasProps = {
  workflow: WorkflowFile;
  selectedNodeId?: string;
  nodeStates: Map<string, NodeExecutionState>;
  /** Node the run is currently paused on (Human Input), shown with a waiting badge. */
  waitingNodeId?: string;
  canRedo: boolean;
  canUndo: boolean;
  onAddNode: (type: WorkflowNodeType, options?: AddNodeOptions) => void;
  /** Armed node type for cursor-follow placement, or null when inactive. */
  placementNodeType?: WorkflowNodeType | null;
  onConfirmPlacement?: (position: { x: number; y: number }) => void;
  onCancelPlacement?: () => void;
  onClearSelection: () => void;
  onCommitGraphHistoryEntry: (entry: WorkflowGraphHistoryEntry) => void;
  onNodeAction: WorkflowNodeActionHandler;
  onRedo: () => void;
  onSelectNode: (nodeId: string) => void;
  onUndo: () => void;
};

const nodeTypes = {
  start: StartWorkflowNode,
  llm: LlmWorkflowNode,
  knowledge: KnowledgeWorkflowNode,
  tool: ToolWorkflowNode,
  code: CodeWorkflowNode,
  ifElse: IfElseWorkflowNode,
  humanInput: HumanInputWorkflowNode,
  template: TemplateWorkflowNode,
  end: EndWorkflowNode,
};

type WorkflowFlowNode = WorkflowReactNode;

const CANVAS_MIN_ZOOM = 0.4;
const CANVAS_MAX_ZOOM = 1.6;
const CANVAS_PANEL_INSET = 16;
const CANVAS_CONTROL_HEIGHT = 36;
const CANVAS_CONTROL_GAP = 12;
const MINI_MAP_WIDTH = 160;
const MINI_MAP_HEIGHT = 120;
const MINI_MAP_BOTTOM_OFFSET = CANVAS_PANEL_INSET + CANVAS_CONTROL_HEIGHT + CANVAS_CONTROL_GAP;

function toFlowNode(
  workflow: WorkflowFile,
  node: WorkflowNode,
  currentNode?: WorkflowFlowNode,
  onOpenNodePalette?: OpenWorkflowNodePalette,
  executionStatus?: "running" | "waiting" | "succeeded" | "failed",
  onNodeAction?: WorkflowNodeActionHandler,
): WorkflowFlowNode {
  const nodeSize = getWorkflowNodeSize(node);
  const handles = getWorkflowNodeHandles(node);
  const activeSettings = node.type === "llm" ? resolveLLMModelSettings(workflow, node) : workflow.settings.modelProvider;
  const activeModel = activeSettings?.model;
  const activeModelProvider = activeSettings?.provider;

  return {
    ...currentNode,
    id: node.id,
    type: node.type,
    position: node.position,
    initialWidth: nodeSize.width,
    initialHeight: nodeSize.height,
    ...(handles ? { handles } : { handles: undefined }),
    selected: currentNode?.selected,
    data: { node, activeModel, activeModelProvider, onOpenNodePalette, executionStatus, onNodeAction },
  };
}

function nodeExecutionStatus(
  node: WorkflowNode,
  nodeStates?: Map<string, import("../types").NodeExecutionState>,
  waitingNodeId?: string,
): "running" | "waiting" | "succeeded" | "failed" | undefined {
  if (waitingNodeId && node.id === waitingNodeId) {
    return "waiting";
  }
  return nodeStates?.get(node.id)?.status;
}

function toFlowNodes(
  workflow: WorkflowFile,
  onOpenNodePalette?: OpenWorkflowNodePalette,
  nodeStates?: Map<string, import("../types").NodeExecutionState>,
  waitingNodeId?: string,
  onNodeAction?: WorkflowNodeActionHandler,
): WorkflowFlowNode[] {
  return workflow.graph.nodes.map((node) => {
    return toFlowNode(
      workflow,
      node,
      undefined,
      onOpenNodePalette,
      nodeExecutionStatus(node, nodeStates, waitingNodeId),
      onNodeAction,
    );
  });
}

function toFlowEdges(edges: WorkflowEdge[], selectedEdgeIds: Set<string>, hoveredNodeId?: string): Edge[] {
  return edges.map((edge) => {
    const selected = selectedEdgeIds.has(edge.id);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      label: edge.label,
      markerEnd: { type: MarkerType.ArrowClosed, color: isConnectedToHoveredNode(edge, hoveredNodeId) ? "#10b981" : undefined },
      selected,
      style: isConnectedToHoveredNode(edge, hoveredNodeId) || selected ? { stroke: "#10b981", strokeWidth: 2.5 } : undefined,
      // zIndex: isConnectedToHoveredNode(edge, hoveredNodeId) ? 1 : undefined,
    }
  });
}

function toWorkflowEdge(edge: Edge): WorkflowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
  };
}

function isConnectedToHoveredNode(edge: WorkflowEdge, hoveredNodeId?: string) {
  return Boolean(hoveredNodeId) && (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
}

export function WorkflowCanvas({
  workflow,
  selectedNodeId,
  nodeStates,
  waitingNodeId,
  canRedo,
  canUndo,
  onAddNode,
  placementNodeType,
  onConfirmPlacement,
  onCancelPlacement,
  onClearSelection,
  onCommitGraphHistoryEntry,
  onNodeAction,
  onRedo,
  onSelectNode,
  onUndo,
}: WorkflowCanvasProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [selectedEdgeIds, setSelectedEdgeIds] = useState(() => new Set<string>());
  const [hoveredNodeId, setHoveredNodeId] = useState<string>();
  const [inlinePalette, setInlinePalette] = useState<InlineNodePaletteState | null>(null);
  const [isInteractive, setIsInteractive] = useState(true);
  const openInlinePalette = useCallback<OpenWorkflowNodePalette>((sourceNode, handleType, anchorElement, sourceHandleId) => {
    setInlinePalette({
      sourceNodeId: sourceNode.id,
      sourceNodeLabel: sourceNode.label,
      handleType,
      sourceHandleId,
      anchorElement,
    });
  }, []);
  const [nodes, setNodes] = useState(() =>
    toFlowNodes(workflow, openInlinePalette, nodeStates, waitingNodeId, onNodeAction),
  );
  const edges = useMemo(
    () => toFlowEdges(workflow.graph.edges, selectedEdgeIds, hoveredNodeId),
    [hoveredNodeId, selectedEdgeIds, workflow.graph.edges],
  );
  const flowKey = workflow.metadata.createdAt;
  const hasStartNode = workflow.graph.nodes.some((node) => node.type === "start");

  useEffect(() => {
    setNodes((currentNodes) => {
      const currentNodesById = new Map(currentNodes.map((node) => [node.id, node]));
      return workflow.graph.nodes.map((node) =>
        toFlowNode(
          workflow,
          node,
          currentNodesById.get(node.id),
          openInlinePalette,
          nodeExecutionStatus(node, nodeStates, waitingNodeId),
          onNodeAction,
        ),
      );
    });
  }, [openInlinePalette, workflow, nodeStates, waitingNodeId, onNodeAction]);

  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const selected = Boolean(selectedNodeId) && node.id === selectedNodeId;
        return node.selected === selected ? node : { ...node, selected };
      }),
    );
  }, [selectedNodeId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const selectionChanges = changes.filter((change) => change.type === "select");
      const removedNodeIds = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
      const onlyClearingSelection =
        selectionChanges.length > 0 && selectionChanges.every((change) => !change.selected) && !changes.some((change) => change.type !== "select");

      setNodes((currentNodes) => {
        const nextNodes = applyNodeChanges(changes, currentNodes) as WorkflowFlowNode[];
        if (!selectedNodeId || !onlyClearingSelection) {
          return nextNodes;
        }

        return nextNodes.map((node) => (node.id === selectedNodeId ? { ...node, selected: true } : node));
      });

      if (removedNodeIds.size > 0) {
        setSelectedEdgeIds((current) => {
          return new Set(
            [...current].filter((edgeId) => {
              const edge = edges.find((candidate) => candidate.id === edgeId);
              return edge && !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target);
            }),
          );
        });
        if (selectedNodeId && removedNodeIds.has(selectedNodeId)) {
          onClearSelection();
        }
        const removedNodes = workflow.graph.nodes.filter((node) => removedNodeIds.has(node.id));
        const removedEdges = workflow.graph.edges.filter(
          (edge) => removedNodeIds.has(edge.source) || removedNodeIds.has(edge.target),
        );
        if (removedNodes.length > 0) {
          onCommitGraphHistoryEntry({ type: "removeNodes", nodes: removedNodes, edges: removedEdges });
        }
      }
    },
    [edges, onClearSelection, onCommitGraphHistoryEntry, selectedNodeId, workflow.graph.edges, workflow.graph.nodes],
  );

  const commitNodePositions = useCallback(
    (nextNodes: WorkflowFlowNode[]) => {
      const nextNodesById = new Map(nextNodes.map((node) => [node.id, node]));
      const positions = workflow.graph.nodes.flatMap((node) => {
        const next = nextNodesById.get(node.id);
        if (!next || (next.position.x === node.position.x && next.position.y === node.position.y)) {
          return [];
        }

        return [{ nodeId: node.id, before: node.position, after: next.position }];
      });

      if (positions.length > 0) {
        onCommitGraphHistoryEntry({ type: "moveNodes", positions });
      }
    },
    [onCommitGraphHistoryEntry, workflow.graph.nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }

      const edgeId = `edge-${connection.source}-${connection.target}-${Date.now()}`;
      const nextEdges = addEdge({ ...connection, id: edgeId }, edges);
      const addedEdge = nextEdges.find((edge) => edge.id === edgeId);
      if (addedEdge && nextEdges.length > edges.length) {
        onCommitGraphHistoryEntry({ type: "addEdge", edge: toWorkflowEdge(addedEdge) });
      }
    },
    [edges, onCommitGraphHistoryEntry],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const selectionChanges = changes.filter((change) => change.type === "select");
      if (selectionChanges.length > 0) {
        setSelectedEdgeIds((current) => {
          const next = new Set(current);
          for (const change of selectionChanges) {
            if (change.selected) {
              next.add(change.id);
            } else {
              next.delete(change.id);
            }
          }
          return next;
        });
      }

      if (!changes.some((change) => change.type === "remove")) {
        return;
      }

      const nextEdges = applyEdgeChanges(changes, edges);
      const removedEdgeIds = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
      const removedEdges = workflow.graph.edges.filter((edge) => removedEdgeIds.has(edge.id));
      setSelectedEdgeIds((current) => {
        const nextEdgeIds = new Set(nextEdges.map((edge) => edge.id));
        return new Set([...current].filter((edgeId) => nextEdgeIds.has(edgeId)));
      });
      if (removedEdges.length > 0) {
        onCommitGraphHistoryEntry({ type: "removeEdges", edges: removedEdges });
      }
    },
    [edges, onCommitGraphHistoryEntry, workflow.graph.edges],
  );

  return (
    <div className="h-full">
      <ReactFlow
        key={flowKey}
        colorMode={resolvedTheme}
        proOptions={{ hideAttribution: true }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        elementsSelectable={isInteractive}
        nodesConnectable={isInteractive}
        nodesDraggable={isInteractive}
        nodesFocusable={isInteractive}
        edgesFocusable={isInteractive}
        edgesReconnectable={false}
        connectionRadius={24}
        deleteKeyCode={["Backspace", "Delete"]}
        panOnDrag={isInteractive}
        panOnScroll={isInteractive}
        selectNodesOnDrag={false}
        zoomOnDoubleClick={isInteractive}
        zoomOnPinch={isInteractive}
        zoomOnScroll={isInteractive}
        minZoom={CANVAS_MIN_ZOOM}
        maxZoom={CANVAS_MAX_ZOOM}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={(_event, _node, nextNodes) => commitNodePositions(nextNodes as WorkflowFlowNode[])}
        onNodeClick={(_event, node) => onSelectNode(node.id)}
        onNodeMouseEnter={(_event, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(undefined)}
      >
        <Background color={isDark ? "#3f3f46" : "#cbd5e1"} gap={22} />
        <MiniMap
          pannable={isInteractive}
          position="bottom-right"
          zoomable={isInteractive}
          nodeColor={(node) => (node.id === selectedNodeId ? "#10b981" : isDark ? "#3f3f46" : "#e2e8f0")}
          nodeStrokeColor={(node) => (node.id === selectedNodeId ? "#047857" : isDark ? "#52525b" : "#94a3b8")}
          nodeStrokeWidth={3}
          nodeBorderRadius={8}
          maskColor={isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(15, 23, 42, 0.18)"}
          style={{
            width: MINI_MAP_WIDTH,
            height: MINI_MAP_HEIGHT,
            right: CANVAS_PANEL_INSET,
            bottom: MINI_MAP_BOTTOM_OFFSET,
            margin: 0,
          }}
          className="!bg-card"
        />
        <Panel position="bottom-right" style={{ right: CANVAS_PANEL_INSET, bottom: CANVAS_PANEL_INSET, margin: 0 }}>
          <WorkflowCanvasControls
            canRedo={canRedo}
            canUndo={canUndo}
            isInteractive={isInteractive}
            maxZoom={CANVAS_MAX_ZOOM}
            minZoom={CANVAS_MIN_ZOOM}
            onRedo={onRedo}
            onToggleInteractive={() => setIsInteractive((current) => !current)}
            onUndo={onUndo}
          />
        </Panel>
        <InlineNodePalettePopover
          hasStartNode={hasStartNode}
          palette={inlinePalette}
          onAddNode={onAddNode}
          onClose={() => setInlinePalette(null)}
        />
        {placementNodeType && onConfirmPlacement && onCancelPlacement && (
          <NodePlacementLayer
            nodeType={placementNodeType}
            onConfirm={onConfirmPlacement}
            onCancel={onCancelPlacement}
          />
        )}
      </ReactFlow>
    </div>
  );
}

/**
 * Full-canvas capture layer for cursor-follow node placement. Rendered inside
 * `<ReactFlow>` so it can read `screenToFlowPosition` from the flow store. While
 * mounted it sits above the pane and swallows pointer events, which both shows a
 * ghost preview under the cursor and suspends pan/select/drag so a single click
 * unambiguously commits the node. `Esc` cancels.
 */
function NodePlacementLayer({
  nodeType,
  onConfirm,
  onCancel,
}: {
  nodeType: WorkflowNodeType;
  onConfirm: (position: { x: number; y: number }) => void;
  onCancel: () => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const Icon = workflowNodeIcons[nodeType];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  return (
    <div
      className="absolute inset-0 z-20 cursor-crosshair"
      onMouseMove={(event) => setPoint({ x: event.clientX, y: event.clientY })}
      onMouseLeave={() => setPoint(null)}
      onClick={(event) => onConfirm(screenToFlowPosition({ x: event.clientX, y: event.clientY }))}
    >
      {point && (
        <div
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border border-border bg-card/95 px-3 py-2 opacity-90 shadow-lg"
          style={{ left: point.x, top: point.y }}
        >
          <span
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
              workflowNodeIconBackgroundClassNames[nodeType],
              workflowNodeIconClassName,
            ].join(" ")}
          >
            <Icon size={16} aria-hidden />
          </span>
          <span className="whitespace-nowrap text-sm font-medium text-card-foreground">{nodeTypeLabel(nodeType)}</span>
        </div>
      )}
    </div>
  );
}
