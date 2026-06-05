import { Loader2 } from "lucide-react";

export function RunEmptyState({ title, detail, loading }: { title: string; detail: string; loading?: boolean }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border p-6 text-center">
      {loading && <Loader2 size={20} className="mb-3 animate-spin text-muted-foreground" aria-hidden />}
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

export function RunErrorBox({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <p className="font-medium">{message}</p>
      {detail && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs">{detail}</pre>}
    </div>
  );
}
