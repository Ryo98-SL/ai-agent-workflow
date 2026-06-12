import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  getAvailableVariables,
  type AvailableVariableGroup,
  type WorkflowEdge,
  type WorkflowNode,
} from "@ai-agent-workflow/workflow-domain";

type WorkflowGraphValue = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodesById: Map<string, WorkflowNode>;
};

const WorkflowGraphContext = createContext<WorkflowGraphValue | null>(null);

/**
 * Provides the current graph (nodes + edges) to deep descendants so Variable Tags
 * can resolve a `{{nodeId.path}}` reference to its producing node's label/type,
 * and pickers can compute Available Variables. Mounted once around the workbench;
 * canvas nodes and inspectors both read from it.
 */
export function WorkflowGraphProvider({
  nodes,
  edges,
  children,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  children: ReactNode;
}) {
  const value = useMemo<WorkflowGraphValue>(
    () => ({ nodes, edges, nodesById: new Map(nodes.map((node) => [node.id, node])) }),
    [nodes, edges],
  );
  return <WorkflowGraphContext.Provider value={value}>{children}</WorkflowGraphContext.Provider>;
}

/** Reads the graph context. Returns null when rendered outside a provider. */
export function useWorkflowGraph(): WorkflowGraphValue | null {
  return useContext(WorkflowGraphContext);
}

/** Resolves a node id to its node (label/type/config), or undefined if missing. */
export function useResolveNode(nodeId: string | undefined): WorkflowNode | undefined {
  const graph = useContext(WorkflowGraphContext);
  return nodeId ? graph?.nodesById.get(nodeId) : undefined;
}

/** Available Variables for a consumer node, recomputed from the live graph. */
export function useAvailableVariables(nodeId: string): AvailableVariableGroup[] {
  const graph = useContext(WorkflowGraphContext);
  return useMemo(
    () => (graph ? getAvailableVariables(graph.nodes, graph.edges, nodeId) : []),
    [graph, nodeId],
  );
}
