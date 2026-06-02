import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { ApiErrorResponse, RunInput } from "@ai-agent-workflow/api-contracts";
import { createApiErrorResponse } from "@ai-agent-workflow/api-contracts";
import {
  resolvePromptWithRuntimeState,
  type LLMNode,
  type OpenAICompatibleSettings,
  type StartNode,
  type WorkflowFile,
  type WorkflowRuntimeState,
} from "@ai-agent-workflow/workflow-domain";

type RuntimeGraphState = {
  values: WorkflowRuntimeState;
};

type RuntimeNodeResult = {
  nodeId: string;
  label: string;
  status: "succeeded" | "failed";
  output: string;
  data?: Record<string, unknown>;
};

export type RuntimeExecutionResult =
  | {
      ok: true;
      state: WorkflowRuntimeState;
      nodeResults: RuntimeNodeResult[];
    }
  | {
      ok: false;
      error: ApiErrorResponse["error"];
      nodeResults: RuntimeNodeResult[];
    };

export type RuntimeExecutorOptions = {
  fetch?: typeof fetch;
};

const RuntimeStateAnnotation = Annotation.Root({
  values: Annotation<WorkflowRuntimeState>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
});

class RuntimeValidationError extends Error {
  code = "validation_error" as const;
}

class RuntimeModelError extends Error {
  code = "internal_error" as const;
}

function normalizeRuntimeError(error: unknown): ApiErrorResponse["error"] {
  if (error instanceof RuntimeValidationError) {
    return createApiErrorResponse(error.code, error.message).error;
  }

  if (error instanceof RuntimeModelError) {
    return createApiErrorResponse(error.code, error.message).error;
  }

  return createApiErrorResponse("internal_error", error instanceof Error ? error.message : "Workflow run failed.").error;
}

function validateWorkflow(workflow: WorkflowFile) {
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

function materializeStartValues(startNode: StartNode, input: RunInput): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of startNode.config.fields) {
    const provided = input[field.name];
    if (provided !== undefined) {
      values[field.name] = provided;
      continue;
    }

    if (field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue;
      continue;
    }

    if (field.required) {
      throw new RuntimeValidationError(`Missing required Start field "${field.name}".`);
    }

    values[field.name] = null;
  }

  return values;
}

function resolvePrompt(prompt: string, state: WorkflowRuntimeState): string {
  const resolution = resolvePromptWithRuntimeState(prompt, state);
  if (!resolution.ok) {
    throw new RuntimeValidationError(`Missing prompt variable values: ${resolution.missingVariables.join(", ")}.`);
  }

  return resolution.text;
}

function chooseModelSettings(workflow: WorkflowFile, node: LLMNode): OpenAICompatibleSettings {
  const settings = workflow.settings.modelProvider;
  if (!settings) {
    throw new RuntimeValidationError("Workflow model provider settings are required for LLM runs.");
  }

  return {
    ...settings,
    model: node.config.model || settings.model,
  };
}

async function callChatCompletion(
  workflow: WorkflowFile,
  node: LLMNode,
  state: WorkflowRuntimeState,
  fetchImpl: typeof fetch,
) {
  const settings = chooseModelSettings(workflow, node);
  const systemPrompt = node.config.systemPrompt ? resolvePrompt(node.config.systemPrompt, state) : "";
  const userPrompt = resolvePrompt(node.config.userPrompt, state);
  const response = await fetchImpl(`${settings.baseURL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: userPrompt },
      ],
      temperature: node.config.temperature,
      max_tokens: node.config.maxTokens,
    }),
  });

  if (!response.ok) {
    throw new RuntimeModelError(`Model endpoint returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as Record<string, any>;
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  const message = choice?.message ?? {};
  const content = message.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : "";
  const reasoning = message.reasoning ?? message.reasoning_content ?? choice?.reasoning ?? null;

  return {
    text,
    usage: payload.usage ?? null,
    reasoning,
  };
}

export async function executeWorkflowRuntime(
  workflow: WorkflowFile,
  input: RunInput,
  options: RuntimeExecutorOptions = {},
): Promise<RuntimeExecutionResult> {
  const nodeResults: RuntimeNodeResult[] = [];
  const fetchImpl = options.fetch ?? fetch;

  try {
    const { startNode, reachableNodes } = validateWorkflow(workflow);
    const nodeById = new Map(workflow.graph.nodes.map((node) => [node.id, node]));
    const graph = new StateGraph(RuntimeStateAnnotation) as any;

    for (const node of reachableNodes) {
      graph.addNode(node.id, async (state: RuntimeGraphState) => {
        try {
          if (node.type === "start") {
            const output = materializeStartValues(node, input);
            nodeResults.push({
              nodeId: node.id,
              label: node.label,
              status: "succeeded",
              output: "Start inputs materialized.",
              data: output,
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
          return { values: { [node.id]: output } };
        } catch (error) {
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

    return { ok: true, state: finalState.values, nodeResults };
  } catch (error) {
    return { ok: false, error: normalizeRuntimeError(error), nodeResults };
  }
}
