# Runtime Tools Index

## Purpose

`apps/server/src/runtime/tools` is the server execution half of the Tool
Registry. Declarative tool descriptors live in `@ai-agent-workflow/workflow-domain`;
this folder owns the matching runtime implementations.

## Structure

- `registry.ts` maps `provider:providerId:toolName` identities to built-in
  runtimes and exports the resolver used by `executor.ts`.
- `types.ts` defines the runtime context, result shape, and execution function
  contract for tool runtimes.
- `currentTime.ts` implements the built-in Current Time tool.
- `emailSend.ts` implements the built-in Send Email tool.

## Behavior

The executor resolves variable-bearing tool params before calling a runtime.
Current Time validates the requested timezone and returns formatted/ISO time
metadata. Send Email validates one recipient plus subject/body limits and
defaults to dry-run composition. Real sending requires the protected
`emailDelivery` capability from `src/email/`, an authenticated user, and a stable
run/tool identity; the runtime never talks to Resend directly.

MCP, custom, and workflow tool providers are represented in the shared schema
but do not have server runtimes yet.
