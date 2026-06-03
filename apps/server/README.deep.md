# Workflow API Server Deep README

## Architecture

`apps/server` is a Hono app with deterministic in-memory storage for workflows,
runs, and events. It intentionally avoids auth, database persistence, queues,
and streaming, but it now executes the supported Start-to-LLM workflow subset
through LangGraph JS.

- `src/app.ts` creates an isolated Hono app and in-memory store for tests or
  runtime, then persists synchronous run results and events. Run requests may
  carry transient model-provider settings and provider keyring values that are
  merged into the workflow used for that execution.
- `src/logger.ts` provides the shared structured logger used by server routes
  and runtime modules. It writes JSON logs through `console` and keeps callers
  responsible for passing only safe summary metadata.
- `src/runtime/` validates supported workflow graphs, materializes Start input
  fields, compiles reachable Start/LLM nodes into a LangGraph StateGraph,
  resolves namespaced prompt variables, and invokes provider-aware model calls
  from the merged workflow/node settings. Provider calls use the matching
  LangChain integrations: `@langchain/deepseek`, `@langchain/openai`,
  `@langchain/anthropic`, and `@langchain/ollama`. The executor and model
  modules emit lifecycle logs for
  execution start/end, node completion, node failure, and model invocation. The
  folder keeps the executor, validation, prompt, Start input, model, error, and
  type modules separate so the runtime can grow without one oversized file.
- `src/index.ts` exports the app factory and starts the Node server when run by
  the package `dev` script.
- `tests/routes.test.ts` covers request validation, normalized errors,
  workflow CRUD routes, provider/keyring model calls, node-level model
  settings, and run event persistence.

## Integration Boundary

All request and response validation uses `@ai-agent-workflow/api-contracts`.
Workflow graph payloads come from `@ai-agent-workflow/workflow-domain`.

## Test Strategy

Route tests call `app.request()` directly. Each test creates a fresh app and can
inject a mocked `fetch`, so workflow IDs, run IDs, timestamps, model output, and
events remain deterministic.
