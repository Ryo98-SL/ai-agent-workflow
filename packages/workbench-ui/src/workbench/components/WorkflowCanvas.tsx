import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  addEdge,
  applyEdgeChanges,
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
  type NodeProps,
} from "@xyflow/react";
import type { WorkflowEdge, WorkflowFile, WorkflowNode } from "@ai-agent-workflow/workflow-domain";

type WorkflowCanvasProps = {
  workflow: WorkflowFile;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
  onWorkflowChange: Dispatch<SetStateAction<WorkflowFile>>;
};

const nodeTypes = {
  workflowNode: WorkflowNodeCard,
};

const workflowNodeSize = {
  width: 184,
  height: 74,
};

const workflowNodeHandles = [
  {
    id: null,
    type: "target" as const,
    position: Position.Left,
    x: -8,
    y: workflowNodeSize.height / 2 - 8,
    width: 16,
    height: 16,
  },
  {
    id: null,
    type: "source" as const,
    position: Position.Right,
    x: workflowNodeSize.width - 8,
    y: workflowNodeSize.height / 2 - 8,
    width: 16,
    height: 16,
  },
];

const handleClassName =
  "!h-4 !w-4 !border-2 !border-white !bg-slate-500 !shadow-sm transition-colors hover:!bg-emerald-600";

type WorkflowFlowNode = Node<{ node: WorkflowNode }, "workflowNode">;

function toFlowNodes(workflowNodes: WorkflowNode[], selectedNodeId?: string): WorkflowFlowNode[] {
  return workflowNodes.map((node) => ({
    id: node.id,
    type: "workflowNode",
    position: node.position,
    initialWidth: workflowNodeSize.width,
    initialHeight: workflowNodeSize.height,
    handles: workflowNodeHandles,
    selected: node.id === selectedNodeId,
    data: { node },
  }));
}

function toFlowEdges(edges: WorkflowEdge[], selectedEdgeIds: Set<string>): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    markerEnd: { type: MarkerType.ArrowClosed },
    selected: selectedEdgeIds.has(edge.id),
  }));
}

function toWorkflowEdges(edges: Edge[]): WorkflowEdge[] {
  return edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }));
}

export function WorkflowCanvas({ workflow, selectedNodeId, onSelectNode, onWorkflowChange }: WorkflowCanvasProps) {
  const [selectedEdgeIds, setSelectedEdgeIds] = useState(() => new Set<string>());
  const defaultNodes = useMemo(() => toFlowNodes(workflow.graph.nodes, selectedNodeId), [selectedNodeId, workflow.graph.nodes]);
  const edges = useMemo(() => toFlowEdges(workflow.graph.edges, selectedEdgeIds), [selectedEdgeIds, workflow.graph.edges]);
  const flowKey = useMemo(
    () =>
      [
        workflow.metadata.createdAt,
        workflow.graph.nodes.map((node) => `${node.id}:${node.type}:${node.label}`).join("|"),
      ].join("::"),
    [workflow.graph.nodes, workflow.metadata.createdAt],
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
        defaultNodes={defaultNodes}
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
        onEdgesChange={onEdgesChange}
        onNodeDragStop={(_event, _node, nextNodes) => persistNodePositions(nextNodes as WorkflowFlowNode[])}
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
          nodeBorderRadius={8}
          maskColor="rgba(248, 250, 252, 0.72)"
          className="!bg-white !shadow-sm"
        />
        <Controls />
      </ReactFlow>
    </div>
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
