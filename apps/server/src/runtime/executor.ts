import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { RunInput } from "@ai-agent-workflow/api-contracts";
import type { WorkflowFile, WorkflowRuntimeState } from "@ai-agent-workflow/workflow-domain";
import { RuntimeValidationError, normalizeRuntimeError } from "./errors";
import { logger } from "../logger";
import { callChatCompletion } from "./models";
import { materializeStartValues } from "./startValues";
import type { RuntimeExecutionResult, RuntimeExecutorOptions, RuntimeNodeResult } from "./types";
import { validateWorkflow } from "./validation";

type RuntimeGraphState = {
  values: WorkflowRuntimeState;
};

const RuntimeStateAnnotation = Annotation.Root({
  values: Annotation<WorkflowRuntimeState>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
});

export async function executeWorkflowRuntime(
  workflow: WorkflowFile,
  input: RunInput,
  options: RuntimeExecutorOptions = {},
): Promise<RuntimeExecutionResult> {
  const nodeResults: RuntimeNodeResult[] = [];
  const fetchImpl = options.fetch ?? fetch;

  try {
    logger.info("runtime.execution.started", {
      workflowName: workflow.metadata.name,
      nodeCount: workflow.graph.nodes.length,
      edgeCount: workflow.graph.edges.length,
      inputKeys: Object.keys(input),
    });
    const { startNode, reachableNodes } = validateWorkflow(workflow);
    const nodeById = new Map(workflow.graph.nodes.map((node) => [node.id, node]));
    const graph = new StateGraph(RuntimeStateAnnotation) as any;

    for (const node of reachableNodes) {
      graph.addNode(node.id, async (state: RuntimeGraphState) => {
        try {
          logger.info("runtime.node.started", {
            nodeId: node.id,
            nodeType: node.type,
            label: node.label,
          });
          if (node.type === "start") {
            const output = materializeStartValues(node, input);
            nodeResults.push({
              nodeId: node.id,
              label: node.label,
              status: "succeeded",
              output: "Start inputs materialized.",
              data: output,
            });
            logger.info("runtime.node.completed", {
              nodeId: node.id,
              nodeType: node.type,
              label: node.label,
              outputKeys: Object.keys(output),
            });
            return { values: { [node.id]: output } };
          }

          if (node.type !== "llm") {
            throw new RuntimeValidationError(`Node "${node.id}" has unsupported runtime type "${node.type}".`);
          }

          const output = await callChatCompletion(workflow, node, state.values, fetchImpl);
          nodeResults.push({
            nodeId: node.id,
            label: node.label,
            status: "succeeded",
            output: output.text,
            data: output,
          });
          logger.info("runtime.node.completed", {
            nodeId: node.id,
            nodeType: node.type,
            label: node.label,
            outputLength: output.text.length,
          });
          return { values: { [node.id]: output } };
        } catch (error) {
          logger.error("runtime.node.failed", {
            nodeId: node.id,
            nodeType: node.type,
            label: node.label,
            message: error instanceof Error ? error.message : "Node failed.",
          });
          nodeResults.push({
            nodeId: node.id,
            label: node.label,
            status: "failed",
            output: error instanceof Error ? error.message : "Node failed.",
          });
          throw error;
        }
      });
    }

    graph.addEdge(START, startNode.id);
    for (const edge of workflow.graph.edges) {
      if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
        throw new RuntimeValidationError(`Workflow edge "${edge.id}" references a missing node.`);
      }
      if (reachableNodes.some((node) => node.id === edge.source) && reachableNodes.some((node) => node.id === edge.target)) {
        graph.addEdge(edge.source, edge.target);
      }
    }

    const terminalIds = reachableNodes
      .map((node) => node.id)
      .filter((nodeId) => !workflow.graph.edges.some((edge) => edge.source === nodeId && nodeById.has(edge.target)));
    for (const nodeId of terminalIds) {
      graph.addEdge(nodeId, END);
    }

    const compiled = graph.compile();
    const finalState = await compiled.invoke({ values: {} });
    logger.info("runtime.execution.completed", {
      workflowName: workflow.metadata.name,
      nodeResultCount: nodeResults.length,
      stateKeys: Object.keys(finalState.values),
    });

    return { ok: true, state: finalState.values, nodeResults };
  } catch (error) {
    const normalizedError = normalizeRuntimeError(error);
    logger.error("runtime.execution.failed", {
      workflowName: workflow.metadata.name,
      nodeResultCount: nodeResults.length,
      errorCode: normalizedError.code,
      message: normalizedError.message,
    });
    return { ok: false, error: normalizedError, nodeResults };
  }
}
