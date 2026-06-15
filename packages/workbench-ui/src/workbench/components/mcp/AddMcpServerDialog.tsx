import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Loader2, Plus, Plug, Trash2 } from "lucide-react";
import type { McpServerDto } from "@ai-agent-workflow/api-contracts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workbench/components/ui/dialog";
import { Input } from "@workbench/components/ui/input";
import { useCreateMcpServer, useUpdateMcpServer } from "../../../data/useMcpServers";
import { Button } from "../Button";
import { Field, errorMessage } from "../knowledge/shared";

type HeaderRow = { name: string; value: string };

type AddMcpServerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits an existing server instead of creating one. */
  server?: McpServerDto;
  onSaved?: (server: McpServerDto) => void;
};

const IDENTIFIER_PATTERN = /^[a-z0-9_-]+$/;

/**
 * Add / edit an HTTP MCP server (ADR 0004). Renders only the **Headers** auth tab —
 * Authentication (OAuth) and Configurations are reserved and intentionally omitted.
 * Header values are write-only (masked) and never returned by the API. On submit the
 * snapshot runs server-side; a connection failure surfaces as the server's `lastError`.
 */
export function AddMcpServerDialog({ open, onOpenChange, server, onSaved }: AddMcpServerDialogProps) {
  const isEdit = Boolean(server);
  const createServer = useCreateMcpServer();
  const updateServer = useUpdateMcpServer();
  const pending = createServer.isPending || updateServer.isPending;

  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("plug");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<HeaderRow[]>([]);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIdentifier(server?.identifier ?? "");
    setName(server?.name ?? "");
    setIcon(server?.icon ?? "plug");
    setUrl(server?.url ?? "");
    setHeaders([]);
    setSnapshotError(null);
    createServer.reset();
    updateServer.reset();
  }, [open, server]);

  const identifierError = useMemo(() => {
    if (isEdit || identifier === "") return null;
    if (identifier.length > 24) return "标识符不能超过 24 个字符。";
    if (!IDENTIFIER_PATTERN.test(identifier)) return "仅限小写字母、数字、下划线或连字符。";
    return null;
  }, [identifier, isEdit]);

  const canSubmit =
    name.trim().length > 0 &&
    url.trim().length > 0 &&
    (isEdit || (identifier.trim().length > 0 && !identifierError)) &&
    headers.every((row) => row.name.trim() && row.value) &&
    !pending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSnapshotError(null);
    const cleanHeaders = headers
      .filter((row) => row.name.trim())
      .map((row) => ({ name: row.name.trim(), value: row.value }));

    const handleResult = (saved: McpServerDto) => {
      if (saved.lastError) {
        // The record was saved, but the snapshot connection failed — keep the dialog
        // open and surface the error so the user can fix the URL/headers.
        setSnapshotError(saved.lastError);
        return;
      }
      onSaved?.(saved);
      onOpenChange(false);
    };

    if (isEdit && server) {
      updateServer.mutate(
        { id: server.id, request: { name: name.trim(), icon, url: url.trim(), ...(cleanHeaders.length ? { headers: cleanHeaders } : {}) } },
        { onSuccess: ({ server: saved }) => handleResult(saved) },
      );
    } else {
      createServer.mutate(
        { identifier: identifier.trim(), name: name.trim(), icon, url: url.trim(), headers: cleanHeaders },
        { onSuccess: ({ server: saved }) => handleResult(saved) },
      );
    }
  };

  const mutationError = createServer.error ?? updateServer.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[210]"
        className="z-[211] flex max-h-[88vh] w-full max-w-lg flex-col gap-0 overflow-hidden border-2 bg-card p-0 shadow-2xl shadow-black/40"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>{isEdit ? `编辑 ${server?.name}` : "添加 MCP 服务器 (HTTP)"}</DialogTitle>
          <DialogDescription>通过 Streamable HTTP 连接，注册后其工具可在工具浏览器中选用。</DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <Field label="服务器 URL" htmlFor="mcp-url">
              <Input
                id="mcp-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/mcp"
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <Field label="图标" htmlFor="mcp-icon">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-700 text-white">
                    <Plug size={16} aria-hidden />
                  </span>
                  <Input
                    id="mcp-icon"
                    value={icon}
                    onChange={(event) => setIcon(event.target.value)}
                    placeholder="plug"
                    className="w-24"
                  />
                </div>
              </Field>
              <Field label="名称" htmlFor="mcp-name">
                <Input id="mcp-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="天气服务" />
              </Field>
            </div>

            <Field label="服务器标识符" htmlFor="mcp-identifier">
              <Input
                id="mcp-identifier"
                value={identifier}
                disabled={isEdit}
                onChange={(event) => setIdentifier(event.target.value.toLowerCase())}
                placeholder="weather"
                aria-invalid={Boolean(identifierError)}
                maxLength={24}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                {identifierError ? (
                  <span className="text-destructive">{identifierError}</span>
                ) : (
                  "唯一标识，工具名将以此为前缀。创建后不可更改。"
                )}
              </span>
            </Field>

            <HeadersSection
              isEdit={isEdit}
              existingHeaderNames={server?.headerNames ?? []}
              headers={headers}
              onChange={setHeaders}
            />

            {snapshotError && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                <span>连接失败：{snapshotError}。服务器已保存，请检查 URL 或请求头后刷新。</span>
              </div>
            )}
            {mutationError && <p className="text-xs text-destructive">{errorMessage(mutationError)}</p>}
          </div>

          <DialogFooter className="shrink-0 border-t border-border p-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" variant="success" size="sm" disabled={!canSubmit}>
              {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Plus size={15} aria-hidden />}
              {isEdit ? "保存" : "添加并连接"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HeadersSection({
  isEdit,
  existingHeaderNames,
  headers,
  onChange,
}: {
  isEdit: boolean;
  existingHeaderNames: string[];
  headers: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
}) {
  const updateRow = (index: number, patch: Partial<HeaderRow>) =>
    onChange(headers.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = (index: number) => onChange(headers.filter((_, i) => i !== index));
  const addRow = () => onChange([...headers, { name: "", value: "" }]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">请求头</h3>
        <span className="text-[11px] text-muted-foreground">用于鉴权（如 Authorization）。值会加密存储，不回显。</span>
      </div>
      {isEdit && existingHeaderNames.length > 0 && headers.length === 0 && (
        <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          已配置 {existingHeaderNames.length} 个请求头（{existingHeaderNames.join("、")}）。留空则保留现有请求头；新增将整体替换。
        </p>
      )}
      {headers.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={row.name}
            onChange={(event) => updateRow(index, { name: event.target.value })}
            placeholder="Authorization"
            aria-label={`请求头名称 ${index + 1}`}
            className="flex-1"
          />
          <Input
            type="password"
            value={row.value}
            onChange={(event) => updateRow(index, { value: event.target.value })}
            placeholder="Bearer …"
            aria-label={`请求头值 ${index + 1}`}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => removeRow(index)}
            aria-label="删除请求头"
            className="grid size-8 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={addRow}>
        <Plus size={14} aria-hidden />
        添加请求头
      </Button>
    </section>
  );
}
