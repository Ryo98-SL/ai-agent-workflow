import type { StartNode, WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { RuntimeValidationError } from "./errors";

export function validateWorkflow(workflow: WorkflowFile) {
  const startNodes = workflow.graph.nodes.filter((node): node is StartNode => node.type === "start");
  if (startNodes.length !== 1) {
    throw new RuntimeValidationError(`Workflow must contain exactly one Start node; found ${startNodes.length}.`);
  }

  const nodeIds = new Set<string>();
  for (const node of workflow.graph.nodes) {
    if (nodeIds.has(node.id)) {
      throw new RuntimeValidationError(`Workflow contains duplicate node id "${node.id}".`);
    }
    nodeIds.add(node.id);
  }

  const reachableIds = collectReachableNodeIds(workflow, startNodes[0].id);
  const reachableNodes = workflow.graph.nodes.filter((node) => reachableIds.has(node.id));
  const unsupported = reachableNodes.find((node) => node.type !== "start" && node.type !== "llm");
  if (unsupported) {
    throw new RuntimeValidationError(`Node "${unsupported.id}" has unsupported runtime type "${unsupported.type}".`);
  }

  if (reachableNodes.some((node) => node.type !== "start") && !workflow.graph.edges.some((edge) => edge.source === startNodes[0].id)) {
    throw new RuntimeValidationError("Workflow Start node must connect to an executable node.");
  }

  return { startNode: startNodes[0], reachableNodes };
}

function collectReachableNodeIds(workflow: WorkflowFile, startId: string): Set<string> {
  const reachable = new Set<string>([startId]);
  const queue = [startId];

  while (queue.length > 0) {
    const source = queue.shift();
    if (!source) {
      continue;
    }

    for (const edge of workflow.graph.edges.filter((item) => item.source === source)) {
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  return reachable;
}
