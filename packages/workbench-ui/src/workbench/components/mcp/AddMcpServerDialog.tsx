import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
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
import { Popover } from "../Popover";
import {
  DEFAULT_MCP_SERVER_ICON,
  MCP_SERVER_ICON_KEYS,
  resolveToolIcon,
} from "../workflowNodes/workflowNodeVisuals";
import { Field, useApiErrorMessage } from "../knowledge/shared";

type HeaderRow = { name: string; value: string };

type AddMcpServerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits an existing server instead of creating one. */
  server?: McpServerDto;
  onSaved?: (server: McpServerDto) => void;
};

/**
 * Add / edit an HTTP MCP server (ADR 0004). Renders only the **Headers** auth tab —
 * Authentication (OAuth) and Configurations are reserved and intentionally omitted.
 * Header values are write-only (masked) and never returned by the API. On submit the
 * snapshot runs server-side; a connection failure surfaces as the server's `lastError`.
 */
export function AddMcpServerDialog({ open, onOpenChange, server, onSaved }: AddMcpServerDialogProps) {
  const isEdit = Boolean(server);
  const resolveErrorMessage = useApiErrorMessage();
  const createServer = useCreateMcpServer();
  const updateServer = useUpdateMcpServer();
  const pending = createServer.isPending || updateServer.isPending;

  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_MCP_SERVER_ICON);
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<HeaderRow[]>([]);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(server?.name ?? "");
    setIcon(server?.icon || DEFAULT_MCP_SERVER_ICON);
    setUrl(server?.url ?? "");
    setHeaders([]);
    setSnapshotError(null);
    createServer.reset();
    updateServer.reset();
  }, [open, server]);

  const canSubmit =
    name.trim().length > 0 &&
    url.trim().length > 0 &&
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
      // No `identifier`: the server derives a unique one from the name.
      createServer.mutate(
        { name: name.trim(), icon, url: url.trim(), headers: cleanHeaders },
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
        onInteractOutside={(event) => {
          // The icon picker portals to <body> (outside the dialog DOM). Don't let
          // an interaction inside it count as "outside" and close the dialog.
          const target = event.detail.originalEvent.target as Element | null;
          if (target?.closest("[data-workbench-popover]")) event.preventDefault();
        }}
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
                <IconPicker value={icon} onChange={setIcon} />
              </Field>
              <Field label="名称" htmlFor="mcp-name">
                <Input id="mcp-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="天气服务" />
              </Field>
            </div>

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
            {mutationError && <p className="text-xs text-destructive">{resolveErrorMessage(mutationError)}</p>}
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

/**
 * Clickable icon swatch → popover grid. Replaces the old free-text icon name
 * input (which never affected the rendered glyph). Keys resolve through the
 * shared `resolveToolIcon`, so the picked icon matches the server list view.
 */
function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  const Current = resolveToolIcon(value);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom-start"
      zIndex={220}
      renderTrigger={({ ref, props }) => (
        <button
          {...props}
          ref={ref}
          id="mcp-icon"
          type="button"
          aria-label="选择图标"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-1 rounded-md border border-border p-1 pr-1.5 transition-colors hover:bg-accent"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-700 text-white">
            <Current size={16} aria-hidden />
          </span>
          <ChevronDown size={14} className="text-muted-foreground" aria-hidden />
        </button>
      )}
    >
      <div className="w-[232px] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl">
        <div className="grid grid-cols-6 gap-1">
          {MCP_SERVER_ICON_KEYS.map((key) => {
            const Glyph = resolveToolIcon(key);
            const selected = value === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
                aria-label={`使用图标 ${key}`}
                aria-pressed={selected}
                title={key}
                className={`relative flex aspect-square items-center justify-center rounded-md border ${
                  selected
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-transparent text-muted-foreground hover:bg-accent"
                }`}
              >
                <Glyph size={16} aria-hidden />
                {selected && <Check size={10} className="absolute right-0.5 top-0.5" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>
    </Popover>
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
