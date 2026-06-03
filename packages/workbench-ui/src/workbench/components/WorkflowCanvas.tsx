import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { resolveLLMModelSettings } from "@ai-agent-workflow/workflow-domain";
import type { WorkflowEdge, WorkflowFile, WorkflowNode, WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import type { AddNodeOptions, NodeExecutionState } from "../types";
import { InlineNodePalettePopover, type InlineNodePaletteState } from "./InlineNodePalettePopover";
import {
  CodeWorkflowNode,
  EndWorkflowNode,
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

type WorkflowCanvasProps = {
  workflow: WorkflowFile;
  selectedNodeId?: string;
  nodeStates: Map<string, NodeExecutionState>;
  onAddNode: (type: WorkflowNodeType, options?: AddNodeOptions) => void;
  onClearSelection: () => void;
  onSelectNode: (nodeId: string) => void;
  onWorkflowChange: Dispatch<SetStateAction<WorkflowFile>>;
};

const nodeTypes = {
  start: StartWorkflowNode,
  llm: LlmWorkflowNode,
  knowledge: KnowledgeWorkflowNode,
  tool: ToolWorkflowNode,
  code: CodeWorkflowNode,
  ifElse: IfElseWorkflowNode,
  template: TemplateWorkflowNode,
  end: EndWorkflowNode,
};

type WorkflowFlowNode = WorkflowReactNode;

function toFlowNode(
  workflow: WorkflowFile,
  node: WorkflowNode,
  currentNode?: WorkflowFlowNode,
  onOpenNodePalette?: OpenWorkflowNodePalette,
  executionStatus?: "running" | "succeeded" | "failed",
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
    data: { node, activeModel, activeModelProvider, onOpenNodePalette, executionStatus },
  };
}

function toFlowNodes(
  workflow: WorkflowFile,
  onOpenNodePalette?: OpenWorkflowNodePalette,
  nodeStates?: Map<string, import("../types").NodeExecutionState>,
): WorkflowFlowNode[] {
  return workflow.graph.nodes.map((node) => {
    return toFlowNode(workflow, node, undefined, onOpenNodePalette, nodeStates?.get(node.id)?.status);
  });
}

function toFlowEdges(edges: WorkflowEdge[], selectedEdgeIds: Set<string>, hoveredNodeId?: string): Edge[] {
  return edges.map((edge) => {
    const selected = selectedEdgeIds.has(edge.id);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      markerEnd: { type: MarkerType.ArrowClosed, color: isConnectedToHoveredNode(edge, hoveredNodeId) ? "#10b981" : undefined },
      selected,
      style: isConnectedToHoveredNode(edge, hoveredNodeId) || selected ? { stroke: "#10b981", strokeWidth: 2.5 } : undefined,
      // zIndex: isConnectedToHoveredNode(edge, hoveredNodeId) ? 1 : undefined,
    }
  });
}

function toWorkflowEdges(edges: Edge[]): WorkflowEdge[] {
  return edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }));
}

function isConnectedToHoveredNode(edge: WorkflowEdge, hoveredNodeId?: string) {
  return Boolean(hoveredNodeId) && (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
}

export function WorkflowCanvas({
  workflow,
  selectedNodeId,
  nodeStates,
  onAddNode,
  onClearSelection,
  onSelectNode,
  onWorkflowChange,
}: WorkflowCanvasProps) {
  const [selectedEdgeIds, setSelectedEdgeIds] = useState(() => new Set<string>());
  const [hoveredNodeId, setHoveredNodeId] = useState<string>();
  const [inlinePalette, setInlinePalette] = useState<InlineNodePaletteState | null>(null);
  const openInlinePalette = useCallback<OpenWorkflowNodePalette>((sourceNode, handleType, anchorElement) => {
    setInlinePalette({
      sourceNodeId: sourceNode.id,
      sourceNodeLabel: sourceNode.label,
      handleType,
      anchorElement,
    });
  }, []);
  const [nodes, setNodes] = useState(() => toFlowNodes(workflow, openInlinePalette, nodeStates));
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
        toFlowNode(workflow, node, currentNodesById.get(node.id), openInlinePalette, nodeStates.get(node.id)?.status),
      );
    });
  }, [openInlinePalette, workflow, nodeStates]);

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
        onWorkflowChange((current) => ({
          ...current,
          graph: {
            ...current.graph,
            nodes: current.graph.nodes.filter((node) => !removedNodeIds.has(node.id)),
            edges: current.graph.edges.filter((edge) => !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target)),
          },
        }));
      }
    },
    [edges, onClearSelection, onWorkflowChange, selectedNodeId],
  );

  const persistNodePositions = useCallback(
    (nextNodes: WorkflowFlowNode[]) => {
      onWorkflowChange((current) => ({
        ...current,
        graph: {
          ...current.graph,
          nodes: current.graph.nodes.map((node) => {
            const next = nextNodes.find((candidate) => candidate.id === node.id);
            return next ? { ...node, position: next.position } : node;
          }),
        },
      }));
    },
    [onWorkflowChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const nextEdges = addEdge({ ...connection, id: `edge-${connection.source}-${connection.target}-${Date.now()}` }, edges);
      onWorkflowChange((current) => ({
        ...current,
        graph: {
          ...current.graph,
          edges: toWorkflowEdges(nextEdges),
        },
      }));
    },
    [edges, onWorkflowChange],
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
      setSelectedEdgeIds((current) => {
        const nextEdgeIds = new Set(nextEdges.map((edge) => edge.id));
        return new Set([...current].filter((edgeId) => nextEdgeIds.has(edgeId)));
      });
      onWorkflowChange((current) => ({
        ...current,
        graph: {
          ...current.graph,
          edges: toWorkflowEdges(nextEdges),
        },
      }));
    },
    [edges, onWorkflowChange],
  );

  return (
    <div className="h-full">
      <ReactFlow
        key={flowKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesConnectable
        nodesDraggable
        nodesFocusable
        edgesFocusable
        edgesReconnectable={false}
        connectionRadius={24}
        deleteKeyCode={["Backspace", "Delete"]}
        selectNodesOnDrag={false}
        minZoom={0.4}
        maxZoom={1.6}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={(_event, _node, nextNodes) => persistNodePositions(nextNodes as WorkflowFlowNode[])}
        onNodeClick={(_event, node) => onSelectNode(node.id)}
        onNodeMouseEnter={(_event, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(undefined)}
      >
        <Background color="#cbd5e1" gap={22} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => (node.id === selectedNodeId ? "#10b981" : "#e2e8f0")}
          nodeStrokeColor={(node) => (node.id === selectedNodeId ? "#047857" : "#94a3b8")}
          nodeStrokeWidth={3}
          nodeBorderRadius={8}
          maskColor="rgba(248, 250, 252, 0.72)"
          className="!bg-white !shadow-sm"
        />
        <Controls className={`rounded-md overflow-hidden`} />
        <InlineNodePalettePopover
          hasStartNode={hasStartNode}
          palette={inlinePalette}
          onAddNode={onAddNode}
          onClose={() => setInlinePalette(null)}
        />
      </ReactFlow>
    </div>
  );
}
