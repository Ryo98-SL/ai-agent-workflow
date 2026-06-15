# MCP Components Index

## Purpose

`packages/workbench-ui/src/workbench/components/mcp` owns the account-level MCP
server management UI (ADR 0004). MCP is HTTP-only and auth-gated; these dialogs
register servers, snapshot their tools, and surface connection state. Data flows
through `data/useMcpServers.ts`.

## Structure

- `McpServersDialog.tsx` — global management dialog (mounted in `WorkbenchLayout`
  beside the Knowledge Bases dialog). Lists registered servers with icon, name,
  identifier, url, tool count, header-name count, and connection (`lastError`)
  state, and exposes Refresh / Edit / Delete. Delete uses the shared inline-confirm
  pattern (CLAUDE.md destructive-action rule).
- `AddMcpServerDialog.tsx` — add / edit an HTTP MCP server. Fields: Server URL,
  Name & Icon, Server Identifier (≤24, `^[a-z0-9_-]+$`, inline validation, fixed
  after create), and a Headers section (add/remove key-value rows; values are
  write-only / masked). Only the Headers auth tab is rendered — Authentication
  (OAuth) and Configurations are reserved and omitted. On submit it calls
  create/update and surfaces the snapshot `lastError` when the connection failed.

## Behavior

Dialogs mutate through the React Query MCP hooks; loading/error/empty/snapshot-
failure states are handled inline (no blank/stuck UI). After a successful load the
hook registers the snapshot descriptors into the client-only domain registry so the
Tool Browser and Agent inspector resolve MCP tools synchronously. The Tool Browser's
MCP tab links here via `onOpenMcpServers`.
