import type { ApiErrorResponse } from "@ai-agent-workflow/api-contracts";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import type { WorkflowRuntimeState } from "@ai-agent-workflow/workflow-domain";

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

export type RuntimeExecutionResult =
  | {
      ok: true;
      state: WorkflowRuntimeState;
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
  onStreamEvent?: (event: RuntimeStreamEvent) => void | Promise<void>;
  threadId?: string;
  /**
   * When set, the run is metered against this many tokens (summed input +
   * output). Once exceeded, remaining graph execution is aborted and the run
   * fails with a credits_exhausted error.
   */
  creditBudget?: number;
};
