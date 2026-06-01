# Workflow API Server Deep README

## Architecture

`apps/server` is a Hono app that implements the Task 03 REST API with
deterministic in-memory storage. It is intentionally temporary and avoids auth,
database persistence, queues, model calls, and real workflow execution.

- `src/app.ts` creates an isolated Hono app and in-memory store for tests or
  runtime.
- `src/index.ts` exports the app factory and starts the Node server when run by
  the package `dev` script.
- `tests/routes.test.ts` covers request validation, normalized errors,
  workflow CRUD routes, and mock run routes.

## Integration Boundary

All request and response validation uses `@ai-agent-workflow/api-contracts`.
Workflow graph payloads come from `@ai-agent-workflow/workflow-domain`.

## Test Strategy

Route tests call `app.request()` directly. Each test creates a fresh app, so
workflow IDs, run IDs, timestamps, mock outputs, and events remain deterministic.
