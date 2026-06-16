# Workflow API Server Index

## Purpose

`apps/server` owns the server-side REST surface for deployment smoke tests,
workflow persistence, account settings, Knowledge Bases, AI credits, live run
streaming, and LangGraph-backed workflow execution.

## Structure

- `src/app.ts` builds the Hono app, validates requests, mounts auth/account/
  credit/Knowledge routes, serves the root smoke-test greeting, manages live run
  memory/SSE buffers, and delegates durable workflow/run persistence to
  repository modules.
- `src/auth/` resolves Better Auth users and encrypts/decrypts stored secrets.
- `src/db/`, `src/workflows/`, and `src/runs/` contain Prisma access and
  repository boundaries for durable records.
- `src/logger.ts` exposes the shared structured logger used by route and
  runtime modules.
- `src/knowledge/` stores KB fixtures, quota constants, chunking, embedding, the
  repository boundary, and the in-process indexing runner.
- `src/routes/` contains account, credits, and Knowledge Base route modules.
- `src/runtime/` compiles executable workflow nodes into LangGraph, materializes
  Start input values, resolves prompt variables, handles tools/branches/human
  review/templates, resolves model settings, and returns structured node output
  data through a folder entrypoint.
- `src/net/` contains network helper code for provider access.
- `src/index.ts` exports server public APIs and starts the Node server for
  `pnpm --filter @ai-agent-workflow/server dev` and
  `pnpm --filter @ai-agent-workflow/server start`.
- `tests/` covers routes, durable repositories, crypto, credits config,
  indexing, runtime behavior, streams, and resume flows.

## Behavior

Create/update routes validate full workflow files. Anonymous workflow storage is
client-local, but the server can execute an inline unsaved workflow. Signed-in
workflows and run history are durable in Postgres. Run creation starts a live
SSE stream, applies workflow defaults, stored provider keys, provider key
preferences, AI credits, node model overrides, and any run-scoped settings, then
stores succeeded, failed, or waiting run records with stable logs, structured
node outputs, interrupts, and events.

Route and runtime modules emit structured JSON logs through `src/logger.ts`.
Log metadata includes safe execution identifiers and summaries, but avoids API
keys, full prompts, and full run inputs.

Knowledge Base routes expose the read-only Chinese example KB to anonymous
users and require authenticated ownership for create/update/delete/document
ingestion. The MVP stores platform-managed semantic embeddings in Postgres
pgvector and does not support PDF/DOCX parsing or hybrid retrieval.

Built-in tools are registered in `src/runtime/tools/`: Current Time returns
formatted time metadata, and Send Email composes a dry-run by default or sends
through the env-gated Resend adapter.

The package exposes `db:deploy` for production Prisma migrations and binds the
server to `HOST` or `0.0.0.0` by default so Railway can route public traffic to
the `$PORT` listener.
