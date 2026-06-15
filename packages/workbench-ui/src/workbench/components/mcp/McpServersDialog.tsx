import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus, Plug, RefreshCw, Server, Trash2 } from "lucide-react";
import type { McpServerDto } from "@ai-agent-workflow/api-contracts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workbench/components/ui/dialog";
import { resolveToolIcon } from "../workflowNodes/workflowNodeVisuals";
import { useSession } from "../../../data/useAccount";
import { useDeleteMcpServer, useMcpServers, useRefreshMcpServer } from "../../../data/useMcpServers";
import { Button } from "../Button";
import { LoadingRow, errorMessage } from "../knowledge/shared";
import { AddMcpServerDialog } from "./AddMcpServerDialog";

type McpServersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Account-level MCP server management (ADR 0004), mirroring the Knowledge Bases
 * dialog. Lists registered HTTP servers with their snapshot state and exposes
 * refresh / edit / delete (delete uses the shared inline-confirm pattern). Mounted
 * globally from `WorkbenchLayout`.
 */
export function McpServersDialog({ open, onOpenChange }: McpServersDialogProps) {
  const session = useSession();
  const isAuthed = Boolean(session.data?.user);
  const serversQuery = useMcpServers();
  const servers = useMemo(() => serversQuery.data?.servers ?? [], [serversQuery.data?.servers]);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<McpServerDto | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[80vh] max-w-2xl flex-col gap-0 overflow-hidden border-2 bg-card p-0 shadow-2xl shadow-black/40">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>MCP 服务器</DialogTitle>
          <DialogDescription>账户级 HTTP MCP 服务器，其工具可在 Agent 工具列表或工具节点中选用。</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-border px-5 py-3">
          <Button variant="successSoft" size="md" disabled={!isAuthed} onClick={() => setAddOpen(true)}>
            <Plus size={15} aria-hidden />
            添加 MCP 服务器
          </Button>
          {!isAuthed && <p className="mt-2 text-xs text-muted-foreground">登录后即可注册 MCP 服务器。</p>}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {serversQuery.isLoading && <LoadingRow />}
          {serversQuery.error && <p className="text-xs text-destructive">{errorMessage(serversQuery.error)}</p>}
          {!serversQuery.isLoading && servers.length === 0 && isAuthed && (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-10 text-center">
              <Server size={28} className="text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">还没有 MCP 服务器。</p>
              <Button variant="successSoft" size="sm" onClick={() => setAddOpen(true)}>
                <Plus size={15} aria-hidden />
                添加 MCP 服务器
              </Button>
            </div>
          )}
          {servers.map((server) => (
            <McpServerRow key={server.id} server={server} onEdit={() => setEditing(server)} />
          ))}
        </div>
      </DialogContent>

      <AddMcpServerDialog open={addOpen} onOpenChange={setAddOpen} />
      <AddMcpServerDialog
        open={Boolean(editing)}
        server={editing ?? undefined}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
      />
    </Dialog>
  );
}

function McpServerRow({ server, onEdit }: { server: McpServerDto; onEdit: () => void }) {
  const refresh = useRefreshMcpServer();
  const remove = useDeleteMcpServer();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const Icon = resolveToolIcon(server.icon ?? "plug");

  // Close the delete popover on Escape before the parent dialog handles it.
  useEffect(() => {
    if (!confirmingDelete) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      setConfirmingDelete(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [confirmingDelete]);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-700 text-white">
          <Icon size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{server.name}</p>
            <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{server.identifier}</code>
            {server.readOnly && (
              <span className="shrink-0 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">内置</span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{server.url}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Plug size={11} aria-hidden /> {server.toolCount} 个工具
            </span>
            <span>{server.headerNames.length} 个请求头</span>
            {server.lastError ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={11} aria-hidden /> 连接失败
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-brand">
                <CheckCircle2 size={11} aria-hidden /> 已连接
              </span>
            )}
          </div>
          {server.lastError && <p className="mt-1 text-xs leading-5 text-amber-600 dark:text-amber-400">{server.lastError}</p>}
        </div>

        {!server.readOnly && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => refresh.mutate(server.id)}
            disabled={refresh.isPending}
            aria-label="刷新工具快照"
            title="刷新工具快照"
            className="grid size-8 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {refresh.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label="编辑服务器"
            title="编辑服务器"
            className="grid size-8 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil size={14} aria-hidden />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setConfirmingDelete((value) => !value)}
              aria-haspopup="dialog"
              aria-expanded={confirmingDelete}
              aria-label="删除服务器"
              title="删除服务器"
              className="grid size-8 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <Trash2 size={14} aria-hidden />
            </button>
            {confirmingDelete && (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setConfirmingDelete(false)}
                />
                <div
                  role="dialog"
                  aria-label="确认删除 MCP 服务器"
                  className="absolute right-0 top-full z-50 mt-2 w-60 rounded-md border border-border bg-popover p-3 text-left shadow-xl shadow-black/40"
                >
                  <p className="text-sm font-medium text-foreground">删除此 MCP 服务器？</p>
                  <p className="mt-1 text-xs text-muted-foreground">绑定了它的工具的 Agent / 工具节点将无法解析。</p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                      取消
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(server.id)}
                    >
                      {remove.isPending && <Loader2 size={15} className="animate-spin" aria-hidden />}
                      删除
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>
      {(refresh.error || remove.error) && (
        <p className="mt-2 text-xs text-destructive">{errorMessage(refresh.error ?? remove.error)}</p>
      )}
    </div>
  );
}
