import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
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
