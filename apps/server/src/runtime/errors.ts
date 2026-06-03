import type { ApiErrorResponse } from "@ai-agent-workflow/api-contracts";
import { createApiErrorResponse } from "@ai-agent-workflow/api-contracts";

export class RuntimeValidationError extends Error {
  code = "validation_error" as const;
}

export class RuntimeModelError extends Error {
  code = "internal_error" as const;
}

export function normalizeRuntimeError(error: unknown): ApiErrorResponse["error"] {
  if (error instanceof RuntimeValidationError) {
    return createApiErrorResponse(error.code, error.message).error;
  }

  if (error instanceof RuntimeModelError) {
    return createApiErrorResponse(error.code, error.message).error;
  }

  return createApiErrorResponse("internal_error", error instanceof Error ? error.message : "Workflow run failed.").error;
}
