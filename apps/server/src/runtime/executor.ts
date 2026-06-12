import { randomUUID } from "node:crypto";
import { Annotation, Command, END, MemorySaver, START, StateGraph, interrupt, isGraphInterrupt } from "@langchain/langgraph";
import {
  KnowledgeNodeOutputDataSchema,
  createApiErrorResponse,
  type KnowledgeNodeOutputData,
  type RunInput,
} from "@ai-agent-workflow/api-contracts";
import {
  IFELSE_ELSE_HANDLE_ID,
  USER_INPUT_NAMESPACE,
  evaluateIfElseNode,
  isChatWorkflow,
  resolveMemorySettings,
  type WorkflowFile,
  type WorkflowNode,
  type WorkflowNodeType,
  type WorkflowRuntimeState,
} from "@ai-agent-workflow/workflow-domain";
import { RuntimeValidationError, normalizeRuntimeError } from "./errors";
import { logger } from "../logger";
import type { EmbeddingAdapter } from "../knowledge/embeddings";
import type { KnowledgeRepository } from "../knowledge/repository";
import { callChatCompletion, summarizeMessages } from "./models";
import { materializeStartValues } from "./startValues";
import { resolvePrompt } from "./prompts";
import type { ChatMessage, EmailSender, RuntimeExecutionResult, RuntimeExecutorOptions, RuntimeInterrupt, RuntimeNodeResult, RuntimeStreamEvent } from "./types";
import { validateWorkflow } from "./validation";

type RuntimeGraphState = {
  values: WorkflowRuntimeState;
  messages: ChatMessage[];
  /** Running summary of compressed older turns (summary-buffer memory). */
  summary: string;
  /** How many leading `messages` are already folded into `summary`. */
  summarizedCount: number;
};

const RuntimeStateAnnotation = Annotation.Root({
  values: Annotation<WorkflowRuntimeState>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  // Conversation memory. Appended to across turns; persisted by the checkpointer
  // when a run reuses a stable conversation thread id. Append-only — compression
  // never rewrites this log; it advances `summarizedCount` instead.
  messages: Annotation<ChatMessage[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  // Summary-buffer compression state (last-write-wins). `summary` holds the folded
  // older turns; `summarizedCount` is the count of leading `messages` it covers, so
  // the live history is `summary` + `messages.slice(summarizedCount)`.
  summary: Annotation<string>({
    reducer: (left, right) => right ?? left,
    default: () => "",
  }),
  summarizedCount: Annotation<number>({
    reducer: (left, right) => right ?? left,
    default: () => 0,
  }),
});

type RuntimeNodeBuildContext = {
  embeddings?: EmbeddingAdapter;
  fetchImpl: typeof fetch;
  input: RunInput;
  /** Chat Mode: this turn's user message (the `{{userInput.query}}` value). */
  query?: string;
  knowledge?: KnowledgeRepository;
  userId: string | null;
  workflow: WorkflowFile;
  emailSender?: EmailSender;
};

type RuntimeNodeOutput = {
  output: string;
  data: Record<string, unknown>;
  stateValue: Record<string, unknown>;
  logMetadata?: Record<string, unknown>;
  /** Conversation turns to append to the shared memory channel. */
  appendMessages?: ChatMessage[];
  /** Summary-buffer update when this node compressed the memory buffer. */
  memoryUpdate?: { summary: string; summarizedCount: number };
};

type RuntimeNodeBuilder = (
  node: WorkflowNode,
  state: RuntimeGraphState,
  context: RuntimeNodeBuildContext,
) => Promise<RuntimeNodeOutput> | RuntimeNodeOutput;

const runtimeNodeBuilders = {
  start: buildStartNode,
  llm: buildLlmNode,
  knowledge: buildKnowledgeNode,
  tool: buildToolNode,
  code: buildPlaceholderNode,
  ifElse: buildIfElseNode,
  humanInput: buildHumanInputNode,
  template: buildPlaceholderNode,
  end: buildEndNode,
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

  // Credit metering: accumulate token usage and abort once the budget is spent.
  let consumedTokens = 0;
  let creditsExhausted = false;
  const creditAbort = options.creditBudget != null ? new AbortController() : undefined;

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
    const context: RuntimeNodeBuildContext = {
      embeddings: options.embeddings,
      fetchImpl,
      input,
      query: options.query,
      knowledge: options.knowledge,
      userId: options.userId ?? null,
      workflow,
      emailSender: options.emailSender,
    };

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
          return {
            values: { [node.id]: result.stateValue },
            ...(result.appendMessages && result.appendMessages.length > 0 ? { messages: result.appendMessages } : {}),
            ...(result.memoryUpdate
              ? { summary: result.memoryUpdate.summary, summarizedCount: result.memoryUpdate.summarizedCount }
              : {}),
          };
        } catch (error) {
          // A Human Input node pausing via interrupt() is not a failure: let the
          // pause bubble up to LangGraph without recording a failed node result.
          if (isGraphInterrupt(error)) {
            throw error;
          }
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
    }

    const reachableEdges = workflow.graph.edges.filter(
      (edge) => reachableNodeIds.has(edge.source) && reachableNodeIds.has(edge.target),
    );

    // If/Else nodes route exclusively through conditional edges keyed by the
    // matched branch's source handle; every other node fans out unconditionally.
    const conditionalSourceIds = new Set(
      reachableNodes.filter((node) => node.type === "ifElse").map((node) => node.id),
    );

    for (const node of reachableNodes) {
      if (node.type !== "ifElse") {
        continue;
      }
      const outgoing = reachableEdges.filter((edge) => edge.source === node.id);
      if (outgoing.length === 0) {
        // No connected branches: handled as a terminal node below.
        conditionalSourceIds.delete(node.id);
        continue;
      }

      const targetsByHandle = new Map<string, string[]>();
      for (const edge of outgoing) {
        const handle = edge.sourceHandle ?? IFELSE_ELSE_HANDLE_ID;
        const targets = targetsByHandle.get(handle) ?? [];
        targets.push(edge.target);
        targetsByHandle.set(handle, targets);
      }
      const possibleTargets = [...new Set(outgoing.map((edge) => edge.target))];

      graph.addConditionalEdges(
        node.id,
        (state: RuntimeGraphState) => {
          const matched = state.values[node.id]?.matched;
          const targets = typeof matched === "string" ? targetsByHandle.get(matched) : undefined;
          // An unconnected branch ends this path rather than throwing.
          return targets && targets.length > 0 ? targets : END;
        },
        [...possibleTargets, END],
      );
    }

    for (const edge of reachableEdges) {
      if (conditionalSourceIds.has(edge.source)) {
        continue;
      }
      graph.addEdge(edge.source, edge.target);
    }

    const terminalIds = reachableNodes
      .map((node) => node.id)
      .filter((nodeId) => !workflow.graph.edges.some((edge) => edge.source === nodeId && nodeById.has(edge.target)));
    for (const nodeId of terminalIds) {
      graph.addEdge(nodeId, END);
    }

    const compiled = graph.compile({ checkpointer });
    let finalGraphState: RuntimeGraphState = { values: {}, messages: [], summary: "", summarizedCount: 0 };

    // Fresh runs start from empty state (plus the ambient `userInput` namespace so
    // `{{userInput.query}}` resolves for every node); resumes re-enter the paused
    // thread with the reviewer's answer, which `interrupt()` returns inside the node.
    const initialValues: WorkflowRuntimeState =
      options.query !== undefined ? { [USER_INPUT_NAMESPACE]: { query: options.query } } : {};
    const streamInput = options.resume ? new Command({ resume: options.resume.value }) : { values: initialValues };

    const streamEventsIterable = compiled.streamEvents(
      streamInput,
      {
        version: "v2",
        configurable: { thread_id: threadId },
        signal: creditAbort?.signal,
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
        const message = nodeResults.find((entry) => entry.nodeId === nodeId && entry.status === "failed")?.output;
        const event: RuntimeStreamEvent = {
          type: "node.failed",
          payload: langEvent,
          nodeId,
          nodeType: node.type,
          durationMs,
          message,
        };
        streamEvents.push(event);
        await options.onStreamEvent?.(event);
      } else if (langEvent.event === "on_chat_model_end" && nodeId) {
        const tokenUsage = extractTokenUsage(langEvent.data);
        if (tokenUsage) {
          const event: RuntimeStreamEvent = { type: "node.tokens", payload: langEvent, nodeId, tokenUsage };
          streamEvents.push(event);
          await options.onStreamEvent?.(event);

          // Meter against the credit budget; stop before any further node runs
          // once the balance is spent.
          consumedTokens += (tokenUsage.inputTokens ?? 0) + (tokenUsage.outputTokens ?? 0);
          if (options.creditBudget != null && consumedTokens >= options.creditBudget && !creditsExhausted) {
            creditsExhausted = true;
            creditAbort?.abort();
          }
        }
      } else if (langEvent.event === "on_chain_end" && !nodeId) {
        if (isRuntimeGraphState(langEvent.data?.output)) {
          finalGraphState = langEvent.data.output as RuntimeGraphState;
        }
      }
    }

    // If the abort stopped iteration without throwing, force the failure path so
    // the run is reported as credits_exhausted rather than a partial success.
    if (creditsExhausted) {
      throw new Error("AI credits exhausted.");
    }

    // A Human Input node may have paused the graph via interrupt(). Inspect the
    // checkpoint: a non-empty `next` with a pending interrupt means the run is
    // waiting for a reviewer rather than finished.
    const snapshot = await compiled.getState({ configurable: { thread_id: threadId } });
    const pendingInterrupt = extractPendingInterrupt(snapshot);
    if (pendingInterrupt) {
      const snapshotState = isRuntimeGraphState(snapshot.values)
        ? (snapshot.values as RuntimeGraphState).values
        : finalGraphState.values;
      logger.info("runtime.execution.waiting_human", {
        workflowName: workflow.metadata.name,
        nodeId: pendingInterrupt.nodeId,
        threadId,
      });
      return {
        ok: true,
        status: "waiting_human",
        interrupt: pendingInterrupt,
        state: snapshotState,
        nodeResults,
        streamEvents,
        consumedTokens,
      };
    }

    logger.info("runtime.execution.completed", {
      workflowName: workflow.metadata.name,
      nodeResultCount: nodeResults.length,
      stateKeys: Object.keys(finalGraphState.values),
      streamEventCount: streamEvents.length,
      threadId,
    });

    return { ok: true, status: "completed", state: finalGraphState.values, nodeResults, streamEvents, consumedTokens };
  } catch (error) {
    // A credit-budget abort surfaces as a generic abort error; report it as a
    // first-class credits_exhausted failure instead.
    const normalizedError = creditsExhausted
      ? createApiErrorResponse(
          "credits_exhausted",
          "AI credits exhausted — the run was stopped. Apply for more credits or switch to an API key.",
        ).error
      : normalizeRuntimeError(error);

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
        message: normalizedError.message,
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
    return { ok: false, error: normalizedError, nodeResults, streamEvents, consumedTokens };
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

/**
 * Rough token estimate for the memory buffer (summary + live turns), using the
 * common ~4-chars-per-token heuristic. Cross-provider tokenizers are avoided for
 * the MVP; this only needs to be good enough to trigger compression consistently.
 */
function estimateMemoryTokens(summary: string, history: ChatMessage[]): number {
  const chars = summary.length + history.reduce((sum, message) => sum + message.content.length, 0);
  return Math.ceil(chars / 4);
}

async function buildLlmNode(
  node: WorkflowNode,
  state: RuntimeGraphState,
  context: RuntimeNodeBuildContext,
): Promise<RuntimeNodeOutput> {
  if (node.type !== "llm") {
    throw new RuntimeValidationError(`Node "${node.id}" cannot run with the LLM node builder.`);
  }

  const useMemory = node.config.memory === true;

  // Live history is the un-summarized tail; older turns live in `summary`.
  let history = useMemory ? state.messages.slice(state.summarizedCount) : [];
  let summary = useMemory ? state.summary : "";
  let memoryUpdate: { summary: string; summarizedCount: number } | undefined;

  // Summary-buffer compression: when the buffer's estimated size exceeds the
  // configured budget, fold all but the last `keepTurns` turns into the summary.
  if (useMemory) {
    const policy = resolveMemorySettings(context.workflow).summary;
    const keepMessages = policy.keepTurns * 2; // a turn = user + assistant
    if (policy.enabled && history.length > keepMessages && estimateMemoryTokens(summary, history) > policy.triggerTokens) {
      const overflow = history.slice(0, history.length - keepMessages);
      summary = await summarizeMessages(context.workflow, node, summary, overflow, context.fetchImpl);
      history = history.slice(history.length - keepMessages);
      memoryUpdate = { summary, summarizedCount: state.summarizedCount + overflow.length };
    }
  }

  const output = await callChatCompletion(context.workflow, node, state.values, context.fetchImpl, history, summary);
  // In Chat Mode the stored user turn is the raw chat message, not the resolved
  // (RAG-injected) prompt, so retrieval blobs don't replay into later turns.
  const userTurn =
    isChatWorkflow(context.workflow) && context.query !== undefined ? context.query : output.userPrompt;
  return {
    output: output.text,
    data: output,
    stateValue: output,
    logMetadata: {
      outputLength: output.text.length,
      memory: useMemory,
      historyTurns: history.length,
      compressed: Boolean(memoryUpdate),
    },
    ...(useMemory
      ? {
          appendMessages: [
            { role: "user", content: userTurn },
            { role: "assistant", content: output.text },
          ] satisfies ChatMessage[],
        }
      : {}),
    ...(memoryUpdate ? { memoryUpdate } : {}),
  };
}

async function buildKnowledgeNode(
  node: WorkflowNode,
  state: RuntimeGraphState,
  context: RuntimeNodeBuildContext,
): Promise<RuntimeNodeOutput> {
  if (node.type !== "knowledge") {
    throw new RuntimeValidationError(`Node "${node.id}" cannot run with the Knowledge node builder.`);
  }
  if (!context.knowledge) {
    throw new RuntimeValidationError("Knowledge repository is not configured for workflow runtime.");
  }
  if (!context.embeddings) {
    throw new RuntimeValidationError("Embedding adapter is not configured for Knowledge retrieval.");
  }
  if (node.config.retrieval.mode !== "semantic") {
    throw new RuntimeValidationError(`Knowledge retrieval mode "${node.config.retrieval.mode}" is not supported yet.`);
  }

  const knowledgeBaseIds = node.config.knowledgeBaseIds.filter(Boolean);
  if (knowledgeBaseIds.length === 0) {
    throw new RuntimeValidationError(`Knowledge node "${node.id}" must select a knowledge base.`);
  }

  await Promise.all(
    knowledgeBaseIds.map(async (knowledgeBaseId) => {
      const knowledgeBase = await context.knowledge!.get(context.userId, knowledgeBaseId);
      if (!knowledgeBase) {
        throw new RuntimeValidationError(`Knowledge base "${knowledgeBaseId}" was not found or is not readable.`);
      }
    }),
  );

  const readyChunkCount = await context.knowledge.countReadyChunks(context.userId, knowledgeBaseIds);
  if (readyChunkCount === 0) {
    throw new RuntimeValidationError("Selected knowledge base has no ready indexed content yet.");
  }

  const query = resolvePrompt(node.config.queryTemplate, state.values).trim();
  if (!query) {
    throw new RuntimeValidationError(`Knowledge node "${node.id}" resolved an empty query.`);
  }

  const [queryEmbedding] = await context.embeddings.embedTexts([query]);
  const result = await context.knowledge.searchReadyChunks(context.userId, knowledgeBaseIds, queryEmbedding, {
    topK: node.config.retrieval.topK,
    scoreThreshold: node.config.retrieval.scoreThreshold,
  });
  const outputData = KnowledgeNodeOutputDataSchema.parse({
    result,
    context: formatKnowledgeContext(result),
    query,
  } satisfies KnowledgeNodeOutputData);

  return {
    output: outputData.context || `Knowledge retrieval returned ${outputData.result.length} segment(s).`,
    data: outputData,
    stateValue: outputData,
    logMetadata: { resultCount: outputData.result.length, queryLength: query.length },
  };
}

function buildIfElseNode(node: WorkflowNode, state: RuntimeGraphState): RuntimeNodeOutput {
  if (node.type !== "ifElse") {
    throw new RuntimeValidationError(`Node "${node.id}" cannot run with the If/Else node builder.`);
  }

  const matched = evaluateIfElseNode(node, state.values);
  const isElse = matched === IFELSE_ELSE_HANDLE_ID;
  const matchedCase = node.config.cases.find((branch) => branch.id === matched);
  const label = isElse ? "else" : matchedCase?.id ?? matched;

  return {
    output: `Matched branch: ${label}`,
    data: { matched },
    stateValue: { matched },
    logMetadata: { matched },
  };
}

async function buildToolNode(
  node: WorkflowNode,
  state: RuntimeGraphState,
  context: RuntimeNodeBuildContext,
): Promise<RuntimeNodeOutput> {
  if (node.type !== "tool") {
    throw new RuntimeValidationError(`Node "${node.id}" cannot run with the Tool node builder.`);
  }

  if (node.config.adapter === "currentTime") {
    const timeZone = node.config.timezone || "UTC";
    let formatted: string;
    try {
      formatted = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date());
    } catch {
      throw new RuntimeValidationError(`Tool node "${node.id}" has an invalid timezone "${timeZone}".`);
    }
    const data = { timezone: timeZone, iso: new Date().toISOString(), formatted };
    return {
      output: formatted,
      data: { text: formatted, data },
      stateValue: { text: formatted, data },
      logMetadata: { adapter: "currentTime", timezone: timeZone },
    };
  }

  // emailSend adapter
  const to = resolvePrompt(node.config.to, state.values).trim();
  const subject = resolvePrompt(node.config.subject, state.values);
  const body = resolvePrompt(node.config.body, state.values);
  if (!to) {
    throw new RuntimeValidationError(`Email tool node "${node.id}" resolved an empty recipient.`);
  }

  // Dry-run (default): compose and output only — nothing is sent, no cost.
  if (!node.config.send) {
    const email = { to, subject, body, sent: false, dryRun: true as const };
    return {
      output: `Email composed (dry-run) → ${to}`,
      data: { text: `Email composed (dry-run) → ${to}`, data: email },
      stateValue: { text: `Email composed (dry-run) → ${to}`, data: email },
      logMetadata: { adapter: "emailSend", dryRun: true, to },
    };
  }

  // Real send: requires a server-configured sender (env-gated Resend).
  if (!context.emailSender) {
    throw new RuntimeValidationError(
      "Email sending is not configured on the server. Disable “Send for real” to compose a dry-run instead.",
    );
  }
  const result = await context.emailSender({ to, subject, body });
  const email = { to, subject, body, sent: true as const, dryRun: false as const, id: result.id };
  return {
    output: `Email sent → ${to}`,
    data: { text: `Email sent → ${to}`, data: email },
    stateValue: { text: `Email sent → ${to}`, data: email },
    logMetadata: { adapter: "emailSend", dryRun: false, to },
  };
}

function buildHumanInputNode(node: WorkflowNode, state: RuntimeGraphState): RuntimeNodeOutput {
  if (node.type !== "humanInput") {
    throw new RuntimeValidationError(`Node "${node.id}" cannot run with the Human Input node builder.`);
  }

  const prompt = resolvePrompt(node.config.prompt, state.values);
  const defaultText = node.config.defaultText ? resolvePrompt(node.config.defaultText, state.values) : undefined;

  // First pass: throws GraphInterrupt and pauses the graph. On resume the
  // reviewer's `{ action_id, action_value }` answer is returned here.
  const answer = interrupt({
    nodeId: node.id,
    prompt,
    actions: node.config.actions,
    allowTextInput: node.config.allowTextInput,
    inputLabel: node.config.inputLabel,
    defaultText,
  }) as { action_id?: unknown; action_value?: unknown } | undefined;

  const action_id = typeof answer?.action_id === "string" ? answer.action_id : "";
  const action_value = typeof answer?.action_value === "string" ? answer.action_value : "";

  return {
    output: action_id ? `Human selected: ${action_id}` : "Human input received.",
    data: { action_id, action_value },
    stateValue: { action_id, action_value },
    logMetadata: { action_id },
  };
}

function extractPendingInterrupt(snapshot: {
  tasks?: ReadonlyArray<{ name?: string; interrupts?: ReadonlyArray<{ id?: string; value?: unknown }> }>;
}): RuntimeInterrupt | undefined {
  for (const task of snapshot.tasks ?? []) {
    const pending = task.interrupts?.[0];
    if (pending) {
      const value = pending.value as { nodeId?: unknown } | undefined;
      const nodeId = value && typeof value.nodeId === "string" ? value.nodeId : task.name ?? "";
      return { nodeId, interruptId: pending.id, value: pending.value };
    }
  }
  return undefined;
}

/**
 * Resolves the End node's Answer Template against runtime state; the result is the
 * run's final output for the path that reached this node. An empty `answer` yields
 * an empty output (no placeholder text).
 */
function buildEndNode(node: WorkflowNode, state: RuntimeGraphState): RuntimeNodeOutput {
  if (node.type !== "end") {
    throw new RuntimeValidationError(`Node "${node.id}" cannot run with the End node builder.`);
  }

  const answer = resolvePrompt(node.config.answer ?? "", state.values);
  return {
    output: answer,
    data: { answer },
    stateValue: { answer },
    logMetadata: { outputLength: answer.length },
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

function formatKnowledgeContext(result: KnowledgeNodeOutputData["result"]): string {
  return result
    .map((segment, index) => {
      const score = Number.isFinite(segment.metadata.score) ? segment.metadata.score.toFixed(3) : "0.000";
      return [
        `【资料 ${index + 1}】${segment.title}`,
        `来源: ${segment.url ?? segment.metadata.documentId}`,
        `相关度: ${score}`,
        segment.content,
      ].join("\n");
    })
    .join("\n\n");
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
  const usageMetadata = extractUsageRecord(output.usage_metadata);
  if (usageMetadata) return usageMetadata;

  const responseMetadata = output.response_metadata;
  if (isRecord(responseMetadata)) {
    const tokenUsage = extractUsageRecord(responseMetadata.tokenUsage);
    if (tokenUsage) return tokenUsage;

    const rawUsage = extractUsageRecord(responseMetadata.usage);
    if (rawUsage) return rawUsage;
  }

  const rawUsage = extractUsageRecord(output.usage);
  if (rawUsage) return rawUsage;

  return undefined;
}

function extractUsageRecord(value: unknown): { inputTokens?: number; outputTokens?: number } | undefined {
  if (!isRecord(value)) return undefined;

  const inputTokens = firstNumber(value, ["input_tokens", "prompt_tokens", "inputTokens", "promptTokens"]);
  const outputTokens = firstNumber(value, ["output_tokens", "completion_tokens", "outputTokens", "completionTokens"]);
  if (inputTokens != null || outputTokens != null) {
    return { inputTokens, outputTokens };
  }

  const totalTokens = firstNumber(value, ["total_tokens", "totalTokens"]);
  if (totalTokens != null) {
    return { inputTokens: totalTokens, outputTokens: 0 };
  }

  return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function isRuntimeGraphState(value: unknown): value is RuntimeGraphState {
  return isRecord(value) && isRecord(value.values);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
