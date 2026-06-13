# Workflow API Server Deep README

## Architecture

`apps/server` is a Hono app backed by Prisma/Postgres for authenticated
workflows, run history, account resources, Knowledge Bases, credits, and durable
LangGraph checkpoints. Anonymous runs and recently completed live run snapshots
remain in memory so the UI can run unsaved drafts and replay stream state.

- `src/app.ts` creates an isolated Hono app and wires workflow, run, SSE,
  resume, credit, account, auth, and Knowledge Base routes. Run requests may
  carry an inline workflow, transient model-provider settings, provider keyring
  values, a stored provider-key id, a Chat Mode query, and a conversation id.
  Run deletion removes the authenticated user's durable row and clears any
  matching owner-scoped in-memory snapshot/events. Authenticated runs use the
  durable Postgres checkpointer when available; anonymous runs use `MemorySaver`.
- `src/auth/` owns Better Auth integration, request user resolution, and AES-GCM
  secret encryption helpers used for provider keys and platform credit keys.
- `src/db/prisma.ts`, `src/workflows/repository.ts`, and `src/runs/repository.ts`
  form the durable Prisma boundaries for workflows and run history.
- `src/logger.ts` provides the shared structured logger used by server routes
  and runtime modules. It writes JSON logs through `console` and keeps callers
  responsible for passing only safe summary metadata.
- `src/knowledge/` owns reusable KB storage, the seeded Chinese customer-support
  example KB, quota constants, text chunking, platform embedding adapters, and
  an in-process indexing runner suitable for the Railway MVP. Postgres uses
  pgvector for chunk embeddings; PDF/DOCX and hybrid retrieval are deferred.
- `src/routes/account.ts` exposes encrypted provider-key storage and custom
  model records. Plaintext provider keys are never returned to clients.
- `src/routes/credits.ts` exposes the one-time AI credit grant and loads the
  platform DeepSeek key used by credit runs.
- `src/routes/knowledge.ts` exposes KB and document CRUD. Anonymous users can
  read the seeded example KB; mutation endpoints require an authenticated owner.
- `src/net/proxy.ts` contains small network/proxy helpers used by server-side
  provider calls.
- `src/runtime/` validates workflow graph shape, materializes Start input
  fields, compiles reachable nodes into a LangGraph `StateGraph`, resolves
  namespaced prompt variables, runs semantic Knowledge retrieval against ready
  KB chunks, evaluates If/Else branches, pauses for Human Input interrupts,
  renders Template outputs, executes built-in Tool runtimes, and invokes
  provider-aware model calls from the merged workflow/node settings. Code nodes
  currently remain placeholders. Provider calls use the matching LangChain
  integrations: `@langchain/deepseek`, `@langchain/openai`,
  `@langchain/anthropic`, and `@langchain/ollama`. The executor runs compiled
  graphs through `.stream()` with `updates`, `messages`, and `values`, captures
  normalized stream events, supports an `onStreamEvent` callback, resumes
  paused runs, and compiles with a LangGraph checkpointer. The executor and
  model modules emit lifecycle logs for execution start/end, node completion,
  node failure, tool execution, and model invocation.
- `src/runtime/tools/` is the server runtime half of the Tool Registry. Built-in
  Current Time and Send Email runtimes are keyed by the same identity triple as
  workflow-domain descriptors; Send Email is dry-run unless an env-gated Resend
  sender is configured.
- `src/index.ts` exports the app factory and starts the Node server when run by
  the package `dev` script.
- `tests/routes.test.ts` covers request validation, normalized errors,
  workflow CRUD routes, provider/keyring model calls, node-level model
  settings, Knowledge Base metadata routes, run streams, resume flows, and run
  event persistence.
- `tests/knowledge-indexing.test.ts` covers deterministic text chunking and the
  in-process indexing runner with a deterministic embedding adapter.
- `tests/runtime.test.ts` covers runtime stream callbacks, checkpoint
  persistence, Knowledge retrieval, tools, branches, templates, and Human Input
  pause/resume behavior.

## Integration Boundary

All request and response validation uses `@ai-agent-workflow/api-contracts`.
Workflow graph payloads come from `@ai-agent-workflow/workflow-domain`.

## Test Strategy

Route tests call `app.request()` directly. Each test creates a fresh app and can
inject repositories, mocked `fetch`, embedding adapters, checkpointers, and
tool senders so workflow IDs, run IDs, timestamps, model output, stream events,
and resume behavior remain deterministic.
