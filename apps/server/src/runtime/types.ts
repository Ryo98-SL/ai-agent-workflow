import type { ApiErrorResponse } from "@ai-agent-workflow/api-contracts";
import type { WorkflowRuntimeState } from "@ai-agent-workflow/workflow-domain";

export type RuntimeNodeResult = {
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
