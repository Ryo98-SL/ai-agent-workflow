# Workflow API Server

Hono API server for workflow persistence, account resources, Knowledge Base
management, and LangGraph-backed workflow execution.

Runtime execution code lives in `src/runtime/`, split by graph execution,
validation, Start input materialization, prompt resolution, model calls, and
tool runtimes. Knowledge Base storage, text chunking, platform-managed
embeddings, and the in-process indexing runner live in `src/knowledge/`.

```bash
pnpm --filter @ai-agent-workflow/server dev
```

The local server listens on `http://127.0.0.1:8788` by default. Set `PORT` to
override the port.

Workflow runs require provider-aware model settings on the workflow when an LLM
node executes. The runtime executes Start, LLM, Knowledge, Tool, If/Else,
Human Input, Template, and End behavior; Code remains a visible placeholder.
The server uses workflow defaults, stored provider keys, provider-key
preferences, AI credit settings, and optional node-level model settings to
choose the provider, model, base URL, resolved API key, temperature, and max
tokens for each LLM node. Run requests can still provide transient model
settings/keyring values for execution.

LangGraph execution streams Server-Sent Events through `/api/runs/:id/stream`.
`executeWorkflowRuntime` collects normalized stream events and can pause on
Human Input nodes; clients resume the same run with `/api/runs/:id/resume`.
Runs can share a `conversationId` so Chat Mode turns reuse LangGraph thread
memory.

Route handling and runtime execution emit structured JSON logs through the
shared `src/logger.ts` module. Log metadata is limited to safe identifiers and
summaries, avoiding API keys, full prompts, and full input payloads.

AI credits use a platform-owned provider key instead of the user's key. For the
MVP, only DeepSeek credits are enabled. `CREDITS_DEEPSEEK_API_KEY` bootstraps an
encrypted `platform_provider_key` row on first use; subsequent runs load the key
from Postgres and force the official DeepSeek base URL before execution. If no
platform key is configured, credit runs return `credits_required` and the user
must add their own provider key.

Knowledge Base MVP ingestion supports pasted text plus text-like file metadata
for `.txt`/optional `.md`. PDF/DOCX parsing, hybrid retrieval, and user-managed
embedding providers are reserved for later releases. Deployments need Postgres
with pgvector enabled (e.g. Railway Postgres) for stored chunk embeddings, plus
the `EMBEDDING_*` env vars (see `.env.example`). MVP quotas are 20 documents per
KB, 100k characters per document, and 500k characters total per account.
Anonymous users can read and run against the seeded read-only Chinese
customer-support example KB (`云舵客服知识库`) but cannot create, upload, or edit
KB data. Knowledge nodes resolve their query template, embed the query with the
platform embedding adapter, retrieve ready chunks from selected readable KBs, and
emit `result`, `context`, and `query` for downstream nodes. If neither
`EMBEDDING_API_KEY` nor `CREDITS_OPENAI_API_KEY` is configured, the background
KB indexer is disabled so local dev can start without marking queued documents
as failed.

Tool nodes bind to the shared workflow-domain Tool Registry. Built-in server
runtimes currently cover Current Time and Send Email. Email defaults to dry-run;
real sending requires `RESEND_API_KEY` and `EMAIL_FROM`.
