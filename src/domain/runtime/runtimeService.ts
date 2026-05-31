import type { WorkflowNode } from "../workflow/schema";
import { llmNodeAdapter } from "./llmAdapter";
import { currentTimeToolAdapter } from "./toolAdapter";
import type { RuntimeAdapterContext, RuntimeResult } from "./types";

export async function executeNode(
  node: WorkflowNode,
  context: RuntimeAdapterContext,
): Promise<RuntimeResult> {
  if (node.type === "llm") {
    return llmNodeAdapter.execute(node, context);
  }

  if (node.type === "tool") {
    return currentTimeToolAdapter.execute(node, context);
  }

  const now = new Date().toISOString();
  return {
    nodeId: node.id,
    nodeType: node.type,
    adapter: "unsupported",
    status: "error",
    startedAt: now,
    completedAt: now,
    latencyMs: 0,
    error: {
      code: "unsupported_node",
      message: `${node.label} nodes are present in the workflow schema but are not executable in the MVP.`,
    },
  };
}
