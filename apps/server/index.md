# Workflow API Server Index

## Purpose

`apps/server` owns the first server-side REST surface for workflow persistence
and mock run inspection.

## Structure

- `src/app.ts` builds the Hono app, validates requests, stores workflows/runs in
  memory, and returns normalized contract responses.
- `src/index.ts` exports server public APIs and starts the local Node server for
  `pnpm --filter @ai-agent-workflow/server dev`.
- `tests/routes.test.ts` covers route behavior and deterministic mock data.

## Behavior

The app starts with one seed workflow. Create/update routes validate full
workflow files. Run creation immediately returns a succeeded mock run with
stable logs, outputs, and events for UI integration tests.
