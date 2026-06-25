import type { ApiErrorCode, ApiErrorResponse } from "@ai-agent-workflow/api-contracts";
import { createApiErrorResponse } from "@ai-agent-workflow/api-contracts";

export class RuntimeValidationError extends Error {
  code = "validation_error" as const;
}

export class RuntimeModelError extends Error {
  code = "internal_error" as const;
}

export class RuntimeApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RuntimeApiError";
  }
}

export function normalizeRuntimeError(error: unknown): ApiErrorResponse["error"] {
  if (error instanceof RuntimeApiError) {
    return createApiErrorResponse(error.code, error.message).error;
  }

  if (error instanceof RuntimeValidationError) {
    return createApiErrorResponse(error.code, error.message).error;
  }

  if (error instanceof RuntimeModelError) {
    return createApiErrorResponse(error.code, error.message).error;
  }

  if (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const code = (error as { code: ApiErrorCode }).code;
    return createApiErrorResponse(code, error.message).error;
  }

  return createApiErrorResponse("internal_error", error instanceof Error ? error.message : "Workflow run failed.").error;
}
