import { useCallback, useMemo, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import type { WorkflowFile, WorkflowNode } from "../../domain/workflow/schema";

type WorkflowCanvasProps = {
  workflow: WorkflowFile;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
  onWorkflowChange: Dispatch<SetStateAction<WorkflowFile>>;
};

const nodeTypes = {
  workflowNode: WorkflowNodeCard,
};

const handleClassName =
  "!h-4 !w-4 !border-2 !border-white !bg-slate-500 !shadow-sm transition-colors hover:!bg-emerald-600";

export function WorkflowCanvas({ workflow, selectedNodeId, onSelectNode, onWorkflowChange }: WorkflowCanvasProps) {
  const nodes = useMemo<Node[]>(
    () =>
      workflow.graph.nodes.map((node) => ({
        id: node.id,
        type: "workflowNode",
        position: node.position,
        selected: node.id === selectedNodeId,
        data: { node },
      })),
    [selectedNodeId, workflow.graph.nodes],
  );

  const edges = useMemo<Edge[]>(
    () =>
      workflow.graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [workflow.graph.edges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nextNodes = applyNodeChanges(changes, nodes);
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
    [nodes, onWorkflowChange],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const nextEdges = applyEdgeChanges(changes, edges);
      onWorkflowChange((current) => ({
        ...current,
        graph: {
          ...current.graph,
          edges: nextEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
        },
      }));
    },
    [edges, onWorkflowChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const nextEdges = addEdge(
        { ...connection, id: `edge-${connection.source}-${connection.target}-${Date.now()}` },
        edges,
      );
      onWorkflowChange((current) => ({
        ...current,
        graph: {
          ...current.graph,
          edges: nextEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
        },
      }));
    },
    [edges, onWorkflowChange],
  );

  return (
    <div className="h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesConnectable
        nodesDraggable
        nodesFocusable
        edgesFocusable
        selectNodesOnDrag={false}
        minZoom={0.4}
        maxZoom={1.6}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_event, node) => onSelectNode(node.id)}
        onSelectionChange={({ nodes: selectedNodes }) => {
          const node = selectedNodes.at(0);
          if (node) {
            onSelectNode(node.id);
          }
        }}
      >
        <Background color="#cbd5e1" gap={22} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => (node.id === selectedNodeId ? "#10b981" : "#e2e8f0")}
          nodeStrokeColor={(node) => (node.id === selectedNodeId ? "#047857" : "#94a3b8")}
          nodeStrokeWidth={3}
          maskColor="rgba(248, 250, 252, 0.72)"
          nodeComponent={MiniMapWorkflowNode}
          className="!bg-white !shadow-sm"
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function MiniMapWorkflowNode({
  id,
  x,
  y,
  width,
  height,
  selected,
  onClick,
}: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  onClick?: (event: MouseEvent, id: string) => void;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={width || 184}
      height={height || 74}
      rx={8}
      ry={8}
      fill={selected ? "#10b981" : "#cbd5e1"}
      stroke={selected ? "#047857" : "#64748b"}
      strokeWidth={selected ? 8 : 5}
      onClick={(event) => onClick?.(event, id)}
    />
  );
}

function WorkflowNodeCard({ data, selected }: NodeProps<Node<{ node: WorkflowNode }>>) {
  const node = data.node;
  const executable = node.type === "llm" || node.type === "tool";

  return (
    <div
      className={[
        "w-[184px] rounded-md border bg-white p-3 shadow-sm",
        selected ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} className={handleClassName} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{node.label}</p>
          <p className="mt-1 text-xs uppercase text-slate-500">{node.type}</p>
        </div>
        <span
          className={[
            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
            executable ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
          ].join(" ")}
        >
          {executable ? "RUN" : "MVP"}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className={handleClassName} />
    </div>
  );
}
