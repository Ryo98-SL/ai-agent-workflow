# Routes Module Index

## Purpose

`apps/server/src/routes` contains focused Hono route modules mounted by
`src/app.ts`.

## Structure

- `account.ts` manages authenticated provider keys and custom model records.
- `credits.ts` exposes AI credit status and application endpoints.
- `email.ts` exposes the public, non-sensitive real-email capability and quota
  snapshot for the current session.
- `knowledge.ts` exposes Knowledge Base and Knowledge Document APIs.
- `mcp.ts` exposes account-level MCP server CRUD + refresh (ADR 0004); it
  snapshots tools through `mcp/client.ts` and stores header secrets encrypted.
  The list route also returns the read-only **Built-in MCP Server** (ADR 0006) to
  everyone, including anonymous callers; the reserved `builtin` identifier and all
  mutating routes stay auth-gated.

## Behavior

Route modules validate request bodies with `@ai-agent-workflow/api-contracts`
schemas and return normalized API errors. Account and credit routes require a
resolved Better Auth user. Knowledge routes allow anonymous reads of the seeded
example KB, while all KB mutations require an authenticated owner. The MCP list route
likewise serves the read-only built-in server anonymously, while every MCP mutation
requires an authenticated owner.

Provider keys and platform credit keys are encrypted server-side; routes only
return labels, provider ids, and masked `last4` metadata. MCP server routes
likewise encrypt auth header secrets and return header NAMES plus the cached
tool snapshot only — never header values.
