import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

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
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
      <Loader2 size={14} className="animate-spin" aria-hidden />
      Loading
    </div>
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed.";
}
