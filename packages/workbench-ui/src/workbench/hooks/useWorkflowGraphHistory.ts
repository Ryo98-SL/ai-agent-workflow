import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { WorkflowEdge, WorkflowFile, WorkflowNode } from "@ai-agent-workflow/workflow-domain";

type WorkflowNodePosition = WorkflowNode["position"];

export type WorkflowGraphHistoryEntry =
  | {
      type: "moveNodes";
      positions: Array<{ nodeId: string; before: WorkflowNodePosition; after: WorkflowNodePosition }>;
    }
  | { type: "addNode"; node: WorkflowNode; edges: WorkflowEdge[] }
  | { type: "removeNodes"; nodes: WorkflowNode[]; edges: WorkflowEdge[] }
  | { type: "addEdge"; edge: WorkflowEdge }
  | { type: "removeEdges"; edges: WorkflowEdge[] };

type WorkflowGraphHistoryOptions = {
  historyLimit?: number;
  setWorkflow: Dispatch<SetStateAction<WorkflowFile>>;
};

const DEFAULT_HISTORY_LIMIT = 100;

export function useWorkflowGraphHistory({
  historyLimit = DEFAULT_HISTORY_LIMIT,
  setWorkflow,
}: WorkflowGraphHistoryOptions) {
  const [past, setPast] = useState<WorkflowGraphHistoryEntry[]>([]);
  const [future, setFuture] = useState<WorkflowGraphHistoryEntry[]>([]);

  const commitGraphHistoryEntry = useCallback(
    (entry: WorkflowGraphHistoryEntry) => {
      setWorkflow((current) => applyWorkflowGraphHistoryEntry(current, entry, "redo"));
      setPast((current) => [...current, entry].slice(-historyLimit));
      setFuture([]);
    },
    [historyLimit, setWorkflow],
  );

  const undo = useCallback(() => {
    const entry = past.at(-1);
    if (!entry) {
      return;
    }

    setWorkflow((current) => applyWorkflowGraphHistoryEntry(current, entry, "undo"));
    setPast(past.slice(0, -1));
    setFuture([entry, ...future]);
  }, [future, past, setWorkflow]);

  const redo = useCallback(() => {
    const [entry, ...remainingFuture] = future;
    if (!entry) {
      return;
    }

    setWorkflow((current) => applyWorkflowGraphHistoryEntry(current, entry, "redo"));
    setPast([...past, entry].slice(-historyLimit));
    setFuture(remainingFuture);
  }, [future, historyLimit, past, setWorkflow]);

  const resetHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    canRedo: future.length > 0,
    canUndo: past.length > 0,
    commitGraphHistoryEntry,
    redo,
    resetHistory,
    undo,
  };
}

export function applyWorkflowGraphHistoryEntry(
  workflow: WorkflowFile,
  entry: WorkflowGraphHistoryEntry,
  direction: "undo" | "redo",
): WorkflowFile {
  switch (entry.type) {
    case "moveNodes":
      return applyNodePositions(workflow, entry.positions, direction);
    case "addNode":
      return direction === "redo"
        ? addNodesAndEdges(workflow, [entry.node], entry.edges)
        : removeNodesAndIncidentEdges(workflow, [entry.node.id], entry.edges.map((edge) => edge.id));
    case "removeNodes":
      return direction === "redo"
        ? removeNodesAndIncidentEdges(
            workflow,
            entry.nodes.map((node) => node.id),
            entry.edges.map((edge) => edge.id),
          )
        : addNodesAndEdges(workflow, entry.nodes, entry.edges);
    case "addEdge":
      return direction === "redo" ? addEdges(workflow, [entry.edge]) : removeEdges(workflow, [entry.edge.id]);
    case "removeEdges":
      return direction === "redo"
        ? removeEdges(
            workflow,
            entry.edges.map((edge) => edge.id),
          )
        : addEdges(workflow, entry.edges);
  }
}

function applyNodePositions(
  workflow: WorkflowFile,
  positions: Array<{ nodeId: string; before: WorkflowNodePosition; after: WorkflowNodePosition }>,
  direction: "undo" | "redo",
): WorkflowFile {
  const positionsByNodeId = new Map(positions.map((position) => [position.nodeId, position]));

  return {
    ...workflow,
    graph: {
      ...workflow.graph,
      nodes: workflow.graph.nodes.map((node) => {
        const position = positionsByNodeId.get(node.id);
        return position ? { ...node, position: direction === "redo" ? position.after : position.before } : node;
      }),
    },
  };
}

function addNodesAndEdges(workflow: WorkflowFile, nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowFile {
  const currentNodeIds = new Set(workflow.graph.nodes.map((node) => node.id));
  const currentEdgeIds = new Set(workflow.graph.edges.map((edge) => edge.id));

  return {
    ...workflow,
    graph: {
      ...workflow.graph,
      nodes: [...workflow.graph.nodes, ...nodes.filter((node) => !currentNodeIds.has(node.id))],
      edges: [...workflow.graph.edges, ...edges.filter((edge) => !currentEdgeIds.has(edge.id))],
    },
  };
}

function addEdges(workflow: WorkflowFile, edges: WorkflowEdge[]): WorkflowFile {
  const currentEdgeIds = new Set(workflow.graph.edges.map((edge) => edge.id));
  return {
    ...workflow,
    graph: {
      ...workflow.graph,
      edges: [...workflow.graph.edges, ...edges.filter((edge) => !currentEdgeIds.has(edge.id))],
    },
  };
}

function removeEdges(workflow: WorkflowFile, edgeIds: string[]): WorkflowFile {
  const removedEdgeIds = new Set(edgeIds);
  return {
    ...workflow,
    graph: {
      ...workflow.graph,
      edges: workflow.graph.edges.filter((edge) => !removedEdgeIds.has(edge.id)),
    },
  };
}

function removeNodesAndIncidentEdges(workflow: WorkflowFile, nodeIds: string[], edgeIds: string[]): WorkflowFile {
  const removedNodeIds = new Set(nodeIds);
  const removedEdgeIds = new Set(edgeIds);

  return {
    ...workflow,
    graph: {
      ...workflow.graph,
      nodes: workflow.graph.nodes.filter((node) => !removedNodeIds.has(node.id)),
      edges: workflow.graph.edges.filter(
        (edge) => !removedEdgeIds.has(edge.id) && !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target),
      ),
    },
  };
}
