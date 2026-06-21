import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { ApiErrorResponse } from "@ai-agent-workflow/api-contracts";
import { useTranslation } from "@ai-agent-workflow/i18n";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function LoadingRow() {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
      <Loader2 size={14} className="animate-spin" aria-hidden />
      {t("knowledge.loading", { defaultValue: "Loading" })}
    </div>
  );
}

export function errorMessage(error: unknown, fallback = "Request failed."): string {
  return error instanceof Error ? error.message : fallback;
}

/** Duck-typed read of the normalized API error code off a WorkflowClientError. */
function apiErrorCode(error: unknown): ApiErrorResponse["error"]["code"] | undefined {
  if (error && typeof error === "object" && "apiError" in error) {
    return (error as { apiError?: ApiErrorResponse }).apiError?.error.code;
  }
  return undefined;
}

/**
 * Returns a localized error-message resolver. API errors carry a normalized
 * `code` (validation_error, conflict, …) whose raw `message` is English contract
 * text; this maps the code to a translated `errors.<code>` string and only falls
 * back to the raw message / fallback when no translation exists.
 */
export function useApiErrorMessage() {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  return (error: unknown, fallback?: string): string => {
    const code = apiErrorCode(error);
    const resolvedFallback =
      fallback ?? (error instanceof Error ? error.message : t("errors.requestFailed", { defaultValue: "Request failed." }));
    if (code) return t(`errors.${code}`, { defaultValue: resolvedFallback });
    return resolvedFallback;
  };
}
