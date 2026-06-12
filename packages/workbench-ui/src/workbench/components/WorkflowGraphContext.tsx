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
 * The consumer node a variable field is being rendered *for* (e.g. the LLM node
 * whose prompt editor holds the chip). Lets a Variable Tag check whether its
 * producing node is still a connected upstream of that consumer. Undefined in
 * read-only contexts (node cards, free-text descriptions), where availability
 * isn't meaningful and chips should never be flagged.
 */
const VariableConsumerContext = createContext<string | undefined>(undefined);

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

/**
 * Scopes its subtree to a variable *consumer* node so descendant Variable Tags
 * can tell whether their producing node is still reachable upstream.
 */
export function VariableConsumerProvider({
  nodeId,
  children,
}: {
  nodeId: string;
  children: ReactNode;
}) {
  return <VariableConsumerContext.Provider value={nodeId}>{children}</VariableConsumerContext.Provider>;
}

export type VariableAvailability = "unknown" | "available" | "unavailable";

/**
 * Resolves whether `producerNodeId` is still a connected upstream of the current
 * variable consumer (see `VariableConsumerProvider`). Returns `"unknown"` when
 * there is no consumer in scope — read-only renders must not flag chips, since
 * "available variables" is undefined without a consumer.
 */
export function useVariableAvailability(producerNodeId: string | undefined): VariableAvailability {
  const graph = useContext(WorkflowGraphContext);
  const consumerNodeId = useContext(VariableConsumerContext);
  return useMemo(() => {
    if (!consumerNodeId || !graph || !producerNodeId) {
      return "unknown";
    }
    const groups = getAvailableVariables(graph.nodes, graph.edges, consumerNodeId);
    return groups.some((group) => group.nodeId === producerNodeId) ? "available" : "unavailable";
  }, [graph, consumerNodeId, producerNodeId]);
}
