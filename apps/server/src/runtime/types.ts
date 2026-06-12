import type { ApiErrorResponse } from "@ai-agent-workflow/api-contracts";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import type { WorkflowRuntimeState } from "@ai-agent-workflow/workflow-domain";
import type { EmbeddingAdapter } from "../knowledge/embeddings";
import type { KnowledgeRepository } from "../knowledge/repository";

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
};

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
