# Workflow API Server Deep README

## Architecture

`apps/server` is a Hono app with deterministic in-memory storage for workflows,
runs, events, and LangGraph checkpoints. It intentionally avoids auth, database
persistence, and queues, but it now executes workflows through LangGraph JS
streaming primitives while preserving the existing synchronous run route.

- `src/app.ts` creates an isolated Hono app and in-memory store for tests or
  runtime, then persists synchronous run results and events. Run requests may
  carry transient model-provider settings and provider keyring values that are
  merged into the workflow used for that execution. Run deletion removes the
  authenticated user's durable run row and clears any matching owner-scoped
  in-memory snapshot/events. The app owns a shared `MemorySaver` checkpointer
  and passes the deterministic run id as the LangGraph `thread_id`.
- `src/logger.ts` provides the shared structured logger used by server routes
  and runtime modules. It writes JSON logs through `console` and keeps callers
  responsible for passing only safe summary metadata.
- `src/runtime/` validates workflow graph shape, materializes Start input
  fields, compiles reachable nodes into a LangGraph `StateGraph`, resolves
  namespaced prompt variables, and invokes provider-aware model calls from the
  merged workflow/node settings. The executor uses a node-builder registry:
  Start and LLM have real builders, while knowledge, tool, code, if/else,
  template, and end nodes currently use placeholder builders that save a node
  snapshot into runtime state. Provider calls use the matching LangChain
  integrations: `@langchain/deepseek`, `@langchain/openai`,
  `@langchain/anthropic`, and `@langchain/ollama`. The executor runs compiled
  graphs through `.stream()` with `updates`, `messages`, and `values`, captures
  normalized stream events, supports an `onStreamEvent` callback, and compiles
  with a LangGraph checkpointer. The executor and model modules emit lifecycle
  logs for execution start/end, node completion, node failure, and model
  invocation. The folder keeps the executor, validation, prompt, Start input,
  model, error, and type modules separate so the runtime can grow without one
  oversized file.
- `src/index.ts` exports the app factory and starts the Node server when run by
  the package `dev` script.
- `tests/routes.test.ts` covers request validation, normalized errors,
  workflow CRUD routes, provider/keyring model calls, node-level model
  settings, placeholder node runs, and run event persistence.
- `tests/runtime.test.ts` covers runtime stream callbacks and checkpoint
  persistence.

## Integration Boundary

All request and response validation uses `@ai-agent-workflow/api-contracts`.
Workflow graph payloads come from `@ai-agent-workflow/workflow-domain`.

## Test Strategy

Route tests call `app.request()` directly. Each test creates a fresh app and can
inject a mocked `fetch`, so workflow IDs, run IDs, timestamps, model output, and
events remain deterministic.
