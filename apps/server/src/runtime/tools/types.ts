import type { JsonValue } from "@ai-agent-workflow/workflow-domain";
import type { EmailSender } from "../types";

/**
 * Server-side runtime half of the Tool Registry (ADR 0003). The declarative
 * descriptor (identity, param-spec, output variables) lives in `workflow-domain`;
 * this is the execution function, keyed by the same `provider+providerId+toolName`
 * identity. Built-in runtimes ship here; MCP/custom runtimes are deferred.
 */

/** Server capabilities a tool runtime may use. */
export type ToolRuntimeContext = {
  /** Sends a composed email when the Email tool's real-send is enabled. */
  emailSender?: EmailSender;
};

/** What a tool runtime returns; the executor wraps it as `{ text, data }` node state. */
export type ToolRunResult = {
  /** Human-readable summary stored as the node's `text` output. */
  output: string;
  /** Structured output stored as the node's `data`. */
  data: Record<string, unknown>;
  logMetadata?: Record<string, unknown>;
};

/**
 * Executes one tool. `params` are already resolved by the executor — variable-bearing
 * string params have had their `{{nodeId.path}}` references substituted.
 */
export type ToolRuntime = {
  provider: string;
  providerId: string;
  toolName: string;
  execute: (params: Record<string, JsonValue>, context: ToolRuntimeContext) => Promise<ToolRunResult> | ToolRunResult;
};
