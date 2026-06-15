import type { ApiErrorResponse } from "@ai-agent-workflow/api-contracts";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { OpenAICompatibleSettings, WorkflowRuntimeState } from "@ai-agent-workflow/workflow-domain";
import type { EmbeddingAdapter } from "../knowledge/embeddings";
import type { KnowledgeRepository } from "../knowledge/repository";
import type { McpServerConnection } from "../mcp/client";

export type RuntimeNodeResult = {
  nodeId: string;
  label: string;
  status: "succeeded" | "failed";
  output: string;
  data?: Record<string, unknown>;
};

export type RuntimeStreamEvent = {
  type: string;
  payload: unknown;
  nodeId?: string;
  nodeType?: string;
  message?: string;
  durationMs?: number;
  output?: string;
  data?: Record<string, unknown>;
  tokenUsage?: { inputTokens?: number; outputTokens?: number };
  /**
   * Agent tool-call observability (`type: "agent.tool"`, ADR 0005). Re-attributed
   * to the parent agent `nodeId` from the prebuilt loop's inner tool events. `tool`
   * is the tool name (MCP tools are `${identifier}__${toolName}`); `phase` is
   * `"start"` (with `args`) or `"end"` (with `result`).
   */
  tool?: string;
  phase?: "start" | "end";
  args?: unknown;
  result?: unknown;
};

/** A bind-capable chat model (the concrete LangChain model used for agent loops). */
export type BoundCapableChatModel = BaseChatModel;

/** A single conversation turn kept in the run thread's memory channel. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type EmailMessage = { to: string; subject: string; body: string };

/** Sends a composed email. Injected so dry-run stays the default and real
 * sending (env-gated Resend) is pluggable and testable. */
export type EmailSender = (email: EmailMessage) => Promise<{ id?: string }>;

/** A pending human-in-the-loop interrupt the run paused on. */
export type RuntimeInterrupt = {
  nodeId: string;
  interruptId?: string;
  /** The form spec the node passed to `interrupt()` (prompt, actions, …). */
  value: unknown;
};

export type RuntimeExecutionResult =
  | {
      ok: true;
      /** `completed` ran to an end; `waiting_human` paused on an interrupt. */
      status: "completed" | "waiting_human";
      state: WorkflowRuntimeState;
      /** Present when `status === "waiting_human"`. */
      interrupt?: RuntimeInterrupt;
      nodeResults: RuntimeNodeResult[];
      streamEvents: RuntimeStreamEvent[];
      /** Summed input + output tokens consumed across LLM calls in this run. */
      consumedTokens: number;
    }
  | {
      ok: false;
      error: ApiErrorResponse["error"];
      nodeResults: RuntimeNodeResult[];
      streamEvents: RuntimeStreamEvent[];
      consumedTokens: number;
    };

export type RuntimeExecutorOptions = {
  checkpointer?: BaseCheckpointSaver;
  fetch?: typeof fetch;
  knowledge?: KnowledgeRepository;
  embeddings?: EmbeddingAdapter;
  onStreamEvent?: (event: RuntimeStreamEvent) => void | Promise<void>;
  threadId?: string;
  userId?: string | null;
  /**
   * Chat Mode: the user's message for this turn. Seeded into runtime state as the
   * `userInput` ambient namespace (`{{userInput.query}}`) and used as the stored
   * memory "user" turn so RAG-injected prompts don't pollute conversation history.
   */
  query?: string;
  /** Sends emails for the Email tool node when real sending is enabled. */
  emailSender?: EmailSender;
  /**
   * Resolves the current user's MCP server connections (decrypted headers) for an
   * Agent node that binds MCP tools (ADR 0004). Injected by the run entry from the
   * per-user MCP repository; absent for anonymous runs (no MCP servers).
   */
  mcpServers?: () => Promise<McpServerConnection[]>;
  /**
   * Test/advanced seam: overrides how an Agent node's bound model is built from
   * resolved settings. Defaults to `createBoundCapableModel(settings, fetch)`.
   */
  agentModelFactory?: (settings: OpenAICompatibleSettings) => BoundCapableChatModel;
  /**
   * When set, the run resumes a paused thread: the graph is re-entered with
   * `Command({ resume: value })` on the existing `threadId`/checkpointer instead
   * of starting fresh. Used to answer a Human Input interrupt.
   */
  resume?: { value: unknown };
  /**
   * When set, the run is metered against this many tokens (summed input +
   * output). Once exceeded, remaining graph execution is aborted and the run
   * fails with a credits_exhausted error.
   */
  creditBudget?: number;
};
