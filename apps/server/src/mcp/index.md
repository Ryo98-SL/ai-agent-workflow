# MCP Module Index

## Purpose

`apps/server/src/mcp` implements MCP as an account-level Tool Registry provider
(ADR 0004): per-user HTTP MCP server records, a snapshot catalog of their tools,
and a runtime connector that hands the agent runtime live LangChain tools.

## Key Files

- `client.ts` — HTTP transport + snapshot via `@langchain/mcp-adapters`
  `MultiServerMCPClient`:
  - `connectClient(server)` — single-server client (Streamable HTTP, SSE fallback).
  - `snapshotTools(server)` — connect, `listTools()`, convert each tool's input
    JSON Schema (via `jsonSchemaToParamSpec`) into a `provider:"mcp"`
    `ToolDescriptor`, then close. Throws a normalized error on failure.
  - `connectMcpTools(servers, opts)` — runtime connector for the agent (T3):
    returns `{ tools: DynamicStructuredTool[]; close }`. Tools are namespaced
    `${identifier}__${toolName}`. A failed server raises a clear error (no silent
    tool drop); the connection is closed before throwing.
  - `mcpToolToDescriptor` / `mcpToolsToDescriptors` — the pure converters.
- `repository.ts` — per-user CRUD (`createPrismaMcpRepository` /
  `createInMemoryMcpRepository`). Header secrets are encrypted at rest
  (`auth/crypto`) as a base64 JSON map; DTOs surface header NAMES + the cached
  tool snapshot only. `getConnection` returns decrypted headers for
  snapshot/refresh/execution.
- `builtin.ts` — the **Built-in MCP Server** catalog (ADR 0006): a code-defined,
  auth-less, read-only example server (no DB row, no migration). Single source of
  truth for the demo tools (`echo` / `calculate` / `get_demo_fact`) — each carries a
  JSON Schema (for authored descriptors) and an equivalent zod shape (for the hosted
  server). Exports `BUILTIN_MCP_IDENTIFIER` (reserved), `builtinToolDescriptors()`,
  `builtinMcpConnection()`, `builtinMcpUrl()` (`BUILTIN_MCP_URL` env → own origin), and
  `builtinMcpServerDto()` (the `readOnly` flag is added to the DTO in T2).
- `builtin-server.ts` — hosts the catalog over the SDK's
  `WebStandardStreamableHTTPServerTransport` (stateless, JSON responses) using the
  official `@modelcontextprotocol/sdk` — never a hand-rolled protocol.
  `handleBuiltinMcpRequest(req)` is mounted at `/mcp/builtin` in `app.ts`.
- `connections.ts` — `loadMcpConnections(repo, userId)`: the MCP connections injected
  into every run (ADR 0006) — the built-in server always, plus the signed-in user's own.

## Behavior

`routes/mcp.ts` exposes `GET/POST /api/mcp-servers`, `PATCH/DELETE
/api/mcp-servers/:id`, and `POST /api/mcp-servers/:id/refresh`. All routes
require an authenticated user (anonymous cannot register). Create/refresh and
url/header updates re-snapshot; a connection failure is stored as `lastError`
(never thrown out of the route), keeping the prior tool list on refresh failure.
HTTP transport only — no stdio, no OAuth/Configurations, no resources/prompts.

The **built-in** server is different: `app.ts` mounts `/mcp/builtin` (no auth gate) and
the runtime self-connects to it via `connectMcpTools` like any other MCP server. It is
returned from `GET /mcp-servers` to everyone (incl. anonymous; per-user servers are
appended only when signed in), carries `readOnly: true`, is injected into every run by
`loadMcpConnections` (`connections.ts` — built-in for anonymous, built-in + own when
authed), and its identifier (`builtin`) is reserved (create rejects it). The other
mutating routes stay auth-gated.
