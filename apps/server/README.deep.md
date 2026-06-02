# Workflow API Server Deep README

## Architecture

`apps/server` is a Hono app with deterministic in-memory storage for workflows,
runs, and events. It intentionally avoids auth, database persistence, queues,
and streaming, but it now executes the supported Start-to-LLM workflow subset
through LangGraph JS.

- `src/app.ts` creates an isolated Hono app and in-memory store for tests or
  runtime, then persists synchronous run results and events.
- `src/runtime.ts` validates supported workflow graphs, materializes Start
  input fields, compiles reachable Start/LLM nodes into a LangGraph StateGraph,
  resolves namespaced prompt variables, and calls OpenAI-compatible chat
  completions.
- `src/index.ts` exports the app factory and starts the Node server when run by
  the package `dev` script.
- `tests/routes.test.ts` covers request validation, normalized errors,
  workflow CRUD routes, and mock run routes.

## Integration Boundary

All request and response validation uses `@ai-agent-workflow/api-contracts`.
Workflow graph payloads come from `@ai-agent-workflow/workflow-domain`.

## Test Strategy

Route tests call `app.request()` directly. Each test creates a fresh app and can
inject a mocked `fetch`, so workflow IDs, run IDs, timestamps, model output, and
events remain deterministic.
