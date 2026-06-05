import { randomUUID } from "node:crypto";
import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import type { RunInput } from "@ai-agent-workflow/api-contracts";
import type { WorkflowFile, WorkflowNode, WorkflowNodeType, WorkflowRuntimeState } from "@ai-agent-workflow/workflow-domain";
import { RuntimeValidationError, normalizeRuntimeError } from "./errors";
import { logger } from "../logger";
import { callChatCompletion } from "./models";
import { materializeStartValues } from "./startValues";
import type { RuntimeExecutionResult, RuntimeExecutorOptions, RuntimeNodeResult, RuntimeStreamEvent } from "./types";
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

type RuntimeNodeBuildContext = {
  fetchImpl: typeof fetch;
  input: RunInput;
  workflow: WorkflowFile;
};

type RuntimeNodeOutput = {
  output: string;
  data: Record<string, unknown>;
  stateValue: Record<string, unknown>;
  logMetadata?: Record<string, unknown>;
};

type RuntimeNodeBuilder = (
  node: WorkflowNode,
  state: RuntimeGraphState,
  context: RuntimeNodeBuildContext,
) => Promise<RuntimeNodeOutput> | RuntimeNodeOutput;

const runtimeNodeBuilders = {
  start: buildStartNode,
  llm: buildLlmNode,
  knowledge: buildPlaceholderNode,
  tool: buildPlaceholderNode,
  code: buildPlaceholderNode,
  ifElse: buildPlaceholderNode,
  template: buildPlaceholderNode,
  end: buildPlaceholderNode,
} satisfies Record<WorkflowNodeType, RuntimeNodeBuilder>;

export async function executeWorkflowRuntime(
  workflow: WorkflowFile,
  input: RunInput,
  options: RuntimeExecutorOptions = {},
): Promise<RuntimeExecutionResult> {
  const nodeResults: RuntimeNodeResult[] = [];
  const streamEvents: RuntimeStreamEvent[] = [];
  const fetchImpl = options.fetch ?? fetch;
  const checkpointer = options.checkpointer ?? new MemorySaver();
  const threadId = options.threadId ?? randomUUID();

  // Hoisted so the catch block can emit a node.failed for the running node.
  const nodeById = new Map(workflow.graph.nodes.map((node) => [node.id, node]));
  const nodeStartTimes = new Map<string, number>();
  let runningNodeId: string | undefined;

  try {
    logger.info("runtime.execution.started", {
      workflowName: workflow.metadata.name,
      nodeCount: workflow.graph.nodes.length,
      edgeCount: workflow.graph.edges.length,
      inputKeys: Object.keys(input),
      threadId,
    });
    const { startNode, reachableNodes } = validateWorkflow(workflow);
    const reachableNodeIds = new Set(reachableNodes.map((node) => node.id));
    const graph = new StateGraph(RuntimeStateAnnotation) as any;
    const context: RuntimeNodeBuildContext = { fetchImpl, input, workflow };

    for (const node of reachableNodes) {
      graph.addNode(node.id, async (state: RuntimeGraphState) => {
        try {
          logger.info("runtime.node.started", {
            nodeId: node.id,
            nodeType: node.type,
            label: node.label,
          });

          const nodeBuilder = runtimeNodeBuilders[node.type];
          if (!nodeBuilder) {
            throw new RuntimeValidationError(`Node "${node.id}" has unsupported runtime type "${node.type}".`);
          }

          const result = await nodeBuilder(node, state, context);
          nodeResults.push({
            nodeId: node.id,
            label: node.label,
            status: "succeeded",
            output: result.output,
            data: result.data,
          });
          logger.info("runtime.node.completed", {
            nodeId: node.id,
            nodeType: node.type,
            label: node.label,
            ...result.logMetadata,
          });
          return { values: { [node.id]: result.stateValue } };
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
      if (reachableNodeIds.has(edge.source) && reachableNodeIds.has(edge.target)) {
        graph.addEdge(edge.source, edge.target);
      }
    }

    const terminalIds = reachableNodes
      .map((node) => node.id)
      .filter((nodeId) => !workflow.graph.edges.some((edge) => edge.source === nodeId && nodeById.has(edge.target)));
    for (const nodeId of terminalIds) {
      graph.addEdge(nodeId, END);
    }

    const compiled = graph.compile({ checkpointer });
    let finalGraphState: RuntimeGraphState = { values: {} };

    const streamEventsIterable = compiled.streamEvents(
      { values: {} },
      {
        version: "v2",
        configurable: { thread_id: threadId },
      },
    );

    for await (const langEvent of streamEventsIterable) {
      const nodeId: string | undefined =
        typeof langEvent.metadata?.langgraph_node === "string" &&
        langEvent.metadata.langgraph_node !== "__start__" &&
        langEvent.name !== "__start__" &&
        nodeById.has(langEvent.metadata.langgraph_node)
          ? langEvent.metadata.langgraph_node
          : undefined;

      if (langEvent.event === "on_chain_start" && nodeId) {
        nodeStartTimes.set(nodeId, Date.now());
        runningNodeId = nodeId;
        const node = nodeById.get(nodeId)!;
        const event: RuntimeStreamEvent = { type: "node.started", payload: langEvent, nodeId, nodeType: node.type };
        streamEvents.push(event);
        await options.onStreamEvent?.(event);
      } else if (langEvent.event === "on_chat_model_stream" && nodeId) {
        const delta = extractStreamDelta(langEvent.data);
        if (delta) {
          const event: RuntimeStreamEvent = { type: "node.stream", payload: langEvent, nodeId, message: delta };
          streamEvents.push(event);
          await options.onStreamEvent?.(event);
        }
      } else if (langEvent.event === "on_chain_end" && nodeId) {
        if (runningNodeId === nodeId) runningNodeId = undefined;
        const startTime = nodeStartTimes.get(nodeId) ?? Date.now();
        const durationMs = Date.now() - startTime;
        const node = nodeById.get(nodeId)!;
        const result = nodeResults.find((entry) => entry.nodeId === nodeId);
        const event: RuntimeStreamEvent = {
          type: "node.completed",
          payload: langEvent,
          nodeId,
          nodeType: node.type,
          durationMs,
          output: result?.output,
          data: result?.data,
        };
        streamEvents.push(event);
        await options.onStreamEvent?.(event);
      } else if (langEvent.event === "on_chain_error" && nodeId) {
        if (runningNodeId === nodeId) runningNodeId = undefined;
        const startTime = nodeStartTimes.get(nodeId) ?? Date.now();
        const durationMs = Date.now() - startTime;
        const node = nodeById.get(nodeId)!;
        const event: RuntimeStreamEvent = { type: "node.failed", payload: langEvent, nodeId, nodeType: node.type, durationMs };
        streamEvents.push(event);
        await options.onStreamEvent?.(event);
      } else if (langEvent.event === "on_chat_model_end" && nodeId) {
        const tokenUsage = extractTokenUsage(langEvent.data);
        if (tokenUsage) {
          const event: RuntimeStreamEvent = { type: "node.tokens", payload: langEvent, nodeId, tokenUsage };
          streamEvents.push(event);
          await options.onStreamEvent?.(event);
        }
      } else if (langEvent.event === "on_chain_end" && !nodeId) {
        if (isRuntimeGraphState(langEvent.data?.output)) {
          finalGraphState = langEvent.data.output as RuntimeGraphState;
        }
      }
    }

    logger.info("runtime.execution.completed", {
      workflowName: workflow.metadata.name,
      nodeResultCount: nodeResults.length,
      stateKeys: Object.keys(finalGraphState.values),
      streamEventCount: streamEvents.length,
      threadId,
    });

    return { ok: true, state: finalGraphState.values, nodeResults, streamEvents };
  } catch (error) {
    const normalizedError = normalizeRuntimeError(error);

    // The streaming iterator aborts on a node error without emitting
    // on_chain_error, so the node that was running never got a node.failed
    // event. Emit one now so the client can render the failure on that node
    // instead of leaving it stuck "running".
    if (runningNodeId && nodeById.has(runningNodeId)) {
      const node = nodeById.get(runningNodeId)!;
      const durationMs = Date.now() - (nodeStartTimes.get(runningNodeId) ?? Date.now());
      const failedEvent: RuntimeStreamEvent = {
        type: "node.failed",
        payload: { message: normalizedError.message },
        nodeId: runningNodeId,
        nodeType: node.type,
        durationMs,
      };
      streamEvents.push(failedEvent);
      try {
        await options.onStreamEvent?.(failedEvent);
      } catch {
        // Ignore listener failures during teardown.
      }
    }

    logger.error("runtime.execution.failed", {
      workflowName: workflow.metadata.name,
      nodeResultCount: nodeResults.length,
      streamEventCount: streamEvents.length,
      errorCode: normalizedError.code,
      message: normalizedError.message,
      threadId,
    });
    return { ok: false, error: normalizedError, nodeResults, streamEvents };
  }
}

function buildStartNode(node: WorkflowNode, _state: RuntimeGraphState, context: RuntimeNodeBuildContext): RuntimeNodeOutput {
  if (node.type !== "start") {
    throw new RuntimeValidationError(`Node "${node.id}" cannot run with the Start node builder.`);
  }

  const output = materializeStartValues(node, context.input);
  return {
    output: "Start inputs materialized.",
    data: output,
    stateValue: output,
    logMetadata: { outputKeys: Object.keys(output) },
  };
}

async function buildLlmNode(
  node: WorkflowNode,
  state: RuntimeGraphState,
  context: RuntimeNodeBuildContext,
): Promise<RuntimeNodeOutput> {
  if (node.type !== "llm") {
    throw new RuntimeValidationError(`Node "${node.id}" cannot run with the LLM node builder.`);
  }

  const output = await callChatCompletion(context.workflow, node, state.values, context.fetchImpl);
  return {
    output: output.text,
    data: output,
    stateValue: output,
    logMetadata: { outputLength: output.text.length },
  };
}

function buildPlaceholderNode(node: WorkflowNode): RuntimeNodeOutput {
  const output = {
    type: node.type,
    label: node.label,
    description: node.description ?? null,
    config: node.config,
    placeholder: true,
  };

  return {
    output: `${node.type} placeholder saved.`,
    data: output,
    stateValue: output,
    logMetadata: { placeholder: true },
  };
}

function extractStreamDelta(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  const chunk = data.chunk;
  if (!isRecord(chunk)) return undefined;
  const content = chunk.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join("");
  }
  return undefined;
}

function extractTokenUsage(data: unknown): { inputTokens?: number; outputTokens?: number } | undefined {
  if (!isRecord(data)) return undefined;
  const output = data.output;
  if (!isRecord(output)) return undefined;
  const usage = (output as Record<string, unknown>).usage_metadata;
  if (isRecord(usage)) {
    return {
      inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : undefined,
      outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : undefined,
    };
  }
  return undefined;
}

function isRuntimeGraphState(value: unknown): value is RuntimeGraphState {
  return isRecord(value) && isRecord(value.values);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
