import { tool, type StructuredToolInterface, type ToolRunnableConfig } from "@langchain/core/tools";
import type { BaseMessage } from "@langchain/core/messages";
import {
  paramSpecToJsonSchema,
  resolveToolDescriptor,
  type AgentToolBinding,
  type JsonValue,
  type ToolDescriptor,
  type WorkflowRuntimeState,
} from "@ai-agent-workflow/workflow-domain";
import { RuntimeApiError, RuntimeValidationError } from "./errors";
import { resolvePrompt } from "./prompts";
import { resolveToolRuntime } from "./tools/registry";
import { stringifyMessageContent } from "./models";
import { connectMcpTools, type McpServerConnection } from "../mcp/client";
import type { EmailDelivery } from "../email/types";

/**
 * Agent tool assembly (ADR 0005). Turns an Agent node's inline tool bindings into
 * LangChain tools the prebuilt function-calling loop can call: built-in/registry
 * tools are wrapped from the existing `ToolRuntime` registry, and MCP tools are
 * connected live via T2's `connectMcpTools`. Author-fixed params are hidden from
 * the model and merged back at call time; everything the author left unset is
 * exposed to the model as a callable argument. Also parses the loop's intermediate
 * messages into the ordered `data.steps` trace and aggregate token usage.
 */

/** One recorded tool call in an agent run's trace (the `data.steps` entries). */
export type AgentStep = { name: string; args: unknown; result: string };

/** Aggregate token usage summed across the loop's model calls. */
export type AgentUsage = { input_tokens: number; output_tokens: number; total_tokens: number };

export type AssembledAgentTools = {
  tools: StructuredToolInterface[];
  /** Closes any live MCP connections. Always call in a `finally`. */
  close: () => Promise<void>;
};

/**
 * Wraps one built-in/registry tool binding as a LangChain tool. The model-facing
 * schema covers only the params the author did NOT fix; `fn(modelArgs)` merges the
 * author-fixed params back in, resolves `{{nodeId.path}}` in variable-bearing
 * params against run state (like the Tool node), runs the registry runtime, and
 * returns the tool's text output.
 */
function buildBuiltinAgentTool(
  binding: AgentToolBinding,
  descriptor: ToolDescriptor,
  values: WorkflowRuntimeState,
  email: {
    delivery?: EmailDelivery;
    userId: string | null;
    runId: string;
    agentNodeId: string;
  },
): StructuredToolInterface {
  const runtime = resolveToolRuntime(binding.provider, binding.providerId, binding.toolName);
  if (!runtime) {
    throw new RuntimeValidationError(`Tool "${descriptor.label}" has no server runtime configured.`);
  }

  // Params the author left unset are exposed to the model; fixed ones are hidden.
  const modelParams = descriptor.params.filter(
    (param) =>
      !(param.name in binding.params) &&
      // Real email sending is always author-controlled. Legacy bindings that
      // predate the UI's explicit `send:false` default must not expose this
      // switch to the model either.
      !(descriptor.toolName === "emailSend" && param.name === "send"),
  );
  const schema = paramSpecToJsonSchema(modelParams);

  return tool(
    async (modelArgs: Record<string, JsonValue>, toolConfig: ToolRunnableConfig) => {
      const merged: Record<string, JsonValue> = { ...binding.params, ...(modelArgs ?? {}) };
      if (descriptor.toolName === "emailSend") {
        merged.send = binding.params.send === true;
      }
      const resolvedParams: Record<string, JsonValue> = {};
      for (const param of descriptor.params) {
        const raw = param.name in merged ? merged[param.name] : (param.default ?? null);
        resolvedParams[param.name] =
          param.supportsVariables && typeof raw === "string" ? resolvePrompt(raw, values) : raw;
      }
      const toolCallId = toolConfig?.toolCall?.id;
      if (descriptor.toolName === "emailSend" && resolvedParams.send === true && !toolCallId) {
        throw new RuntimeApiError(
          "email_unavailable",
          "Email sending requires a stable Agent tool-call identity and was blocked to prevent duplicates.",
        );
      }
      const emailIdentity =
        descriptor.toolName === "emailSend" && toolCallId
          ? {
              userId: email.userId,
              idempotencyKey: `${email.runId}:agent:${email.agentNodeId}:${toolCallId}`,
            }
          : undefined;
      const result = await runtime.execute(resolvedParams, {
        emailDelivery: email.delivery,
        emailIdentity,
      });
      return result.output;
    },
    {
      name: descriptor.toolName,
      description: descriptor.description ?? descriptor.label,
      schema,
    },
  );
}

/**
 * Wraps a live MCP tool to inject the binding's author-fixed params at call time.
 * The MCP input schema (full) stays the model-facing schema; fixed params win on
 * overlap. When the author fixed nothing (the common case) the live tool is used
 * as-is to avoid re-deriving its schema.
 */
function wrapMcpAgentTool(liveTool: StructuredToolInterface, binding: AgentToolBinding): StructuredToolInterface {
  const fixed = binding.params;
  if (Object.keys(fixed).length === 0) {
    return liveTool;
  }
  return tool(
    async (modelArgs: Record<string, JsonValue>) => {
      const merged = { ...(modelArgs ?? {}), ...fixed };
      const output = await liveTool.invoke(merged);
      return typeof output === "string" ? output : stringifyMessageContent(output);
    },
    {
      name: liveTool.name,
      description: liveTool.description,
      schema: liveTool.schema,
    },
  );
}

/**
 * Builds all LangChain tools for an agent's bindings. Built-in tools resolve
 * synchronously; MCP tools connect live (a single `MultiServerMCPClient` over the
 * referenced servers) and the returned `close()` MUST be awaited in a `finally`.
 *
 * @param mcpConnections Resolves the current user's MCP server connections
 *   (decrypted headers). Required only when the agent binds MCP tools.
 */
export async function assembleAgentTools(params: {
  bindings: AgentToolBinding[];
  values: WorkflowRuntimeState;
  email: {
    delivery?: EmailDelivery;
    userId: string | null;
    runId: string;
    agentNodeId: string;
  };
  mcpConnections?: () => Promise<McpServerConnection[]>;
}): Promise<AssembledAgentTools> {
  const { bindings, values, email, mcpConnections } = params;
  const tools: StructuredToolInterface[] = [];
  let close: () => Promise<void> = async () => {};

  // Built-in / registry tools.
  for (const binding of bindings) {
    if (binding.provider === "mcp") {
      continue;
    }
    const descriptor = resolveToolDescriptor(binding);
    if (!descriptor) {
      throw new RuntimeValidationError(
        `Agent tool "${binding.provider}:${binding.providerId}:${binding.toolName}" is not a known tool.`,
      );
    }
    tools.push(buildBuiltinAgentTool(binding, descriptor, values, email));
  }

  // MCP tools — connect live to the referenced servers, then match by name.
  const mcpBindings = bindings.filter((binding) => binding.provider === "mcp");
  if (mcpBindings.length > 0) {
    if (!mcpConnections) {
      throw new RuntimeValidationError("MCP tools require an authenticated user with registered MCP servers.");
    }
    const allConnections = await mcpConnections();
    const neededIds = new Set(mcpBindings.map((binding) => binding.providerId));
    const connections = allConnections.filter((connection) => neededIds.has(connection.identifier));
    const missing = [...neededIds].filter((id) => !connections.some((connection) => connection.identifier === id));
    if (missing.length > 0) {
      throw new RuntimeValidationError(`MCP server(s) not found or not accessible: ${missing.join(", ")}.`);
    }

    const connected = await connectMcpTools(connections);
    close = connected.close;
    try {
      for (const binding of mcpBindings) {
        const fullName = `${binding.providerId}__${binding.toolName}`;
        const liveTool = connected.tools.find((candidate) => candidate.name === fullName);
        if (!liveTool) {
          throw new RuntimeValidationError(
            `MCP tool "${binding.toolName}" was not found on server "${binding.providerId}".`,
          );
        }
        tools.push(wrapMcpAgentTool(liveTool, binding));
      }
    } catch (error) {
      await close();
      throw error;
    }
  }

  return { tools, close };
}

/** Narrowing helpers over LangChain messages without relying on instanceof. */
function messageType(message: BaseMessage): string {
  const candidate = message as { getType?: () => string; _getType?: () => string };
  return candidate.getType?.() ?? candidate._getType?.() ?? "";
}

/**
 * Parses the prebuilt agent's intermediate messages into the ordered tool-call
 * trace (`data.steps`). Tool results are keyed back to their call by
 * `tool_call_id`; calls are emitted in the order the model issued them.
 */
export function extractAgentSteps(messages: BaseMessage[]): AgentStep[] {
  const resultsByCallId = new Map<string, string>();
  for (const message of messages) {
    if (messageType(message) === "tool") {
      const id = (message as { tool_call_id?: string }).tool_call_id;
      if (id) {
        resultsByCallId.set(id, stringifyMessageContent(message.content));
      }
    }
  }

  const steps: AgentStep[] = [];
  for (const message of messages) {
    const toolCalls = (message as { tool_calls?: Array<{ id?: string; name: string; args: unknown }> }).tool_calls;
    if (Array.isArray(toolCalls)) {
      for (const call of toolCalls) {
        steps.push({
          name: call.name,
          args: call.args,
          result: call.id ? resultsByCallId.get(call.id) ?? "" : "",
        });
      }
    }
  }
  return steps;
}

/** Sums token usage across every model turn in the loop. */
export function extractAgentUsage(messages: BaseMessage[]): AgentUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  for (const message of messages) {
    const usage = (message as { usage_metadata?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } })
      .usage_metadata;
    if (usage) {
      inputTokens += usage.input_tokens ?? 0;
      outputTokens += usage.output_tokens ?? 0;
      totalTokens += usage.total_tokens ?? 0;
    }
  }
  return { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: totalTokens };
}
