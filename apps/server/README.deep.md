# Workflow API Server Deep README

## Architecture

`apps/server` is a Hono app with deterministic in-memory storage for workflows,
runs, events, and LangGraph checkpoints. It intentionally avoids auth, database
persistence, and queues, but it now executes workflows through LangGraph JS
streaming primitives while preserving the existing synchronous run route.

- `src/app.ts` creates an isolated Hono app and wires workflow, run, credit,
  account, and Knowledge Base routes. Run requests may
  carry transient model-provider settings and provider keyring values that are
  merged into the workflow used for that execution. Run deletion removes the
  authenticated user's durable run row and clears any matching owner-scoped
  in-memory snapshot/events. The app owns a shared `MemorySaver` checkpointer
  and passes the deterministic run id as the LangGraph `thread_id`.
- `src/logger.ts` provides the shared structured logger used by server routes
  and runtime modules. It writes JSON logs through `console` and keeps callers
  responsible for passing only safe summary metadata.
- `src/knowledge/` owns reusable KB storage, the seeded Chinese customer-support
  example KB, quota constants, text chunking, platform embedding adapters, and
  an in-process indexing runner suitable for the Railway MVP. Postgres uses
  pgvector for chunk embeddings; PDF/DOCX and hybrid retrieval are deferred.
- `src/routes/knowledge.ts` exposes KB and document CRUD. Anonymous users can
  read the seeded example KB; mutation endpoints require an authenticated owner.
- `src/runtime/` validates workflow graph shape, materializes Start input
  fields, compiles reachable nodes into a LangGraph `StateGraph`, resolves
  namespaced prompt variables, runs semantic Knowledge retrieval against ready
  KB chunks, and invokes provider-aware model calls from the merged
  workflow/node settings. The executor uses a node-builder registry: Start, LLM,
  and Knowledge have real builders, while tool, code, if/else, template, and end
  nodes currently use placeholder builders that save a node snapshot into
  runtime state. Provider calls use the matching LangChain
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
  settings, Knowledge Base metadata routes, placeholder node runs, and run event
  persistence.
- `tests/knowledge-indexing.test.ts` covers deterministic text chunking and the
  in-process indexing runner with a deterministic embedding adapter.
- `tests/runtime.test.ts` covers runtime stream callbacks, checkpoint
  persistence, and Knowledge retrieval success/failure behavior.

## Integration Boundary

All request and response validation uses `@ai-agent-workflow/api-contracts`.
Workflow graph payloads come from `@ai-agent-workflow/workflow-domain`.

## Test Strategy

Route tests call `app.request()` directly. Each test creates a fresh app and can
inject a mocked `fetch`, so workflow IDs, run IDs, timestamps, model output, and
events remain deterministic.
