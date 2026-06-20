# AI Agent Workflow

Web-first monorepo for debugging AI agent workflow graphs.

## Commands

```bash
pnpm install
pnpm dev
pnpm dev:web
pnpm dev:server
pnpm dev:desktop
pnpm typecheck
pnpm test
pnpm lint
pnpm smoke
pnpm build
```

`pnpm dev` starts the API server on port `8788` and the web app at
`http://127.0.0.1:5173`. The web and desktop renderers use
`VITE_WORKFLOW_API_BASE_URL` when a different API origin is needed.

For production API deploys, run Prisma migrations with
`pnpm --filter @ai-agent-workflow/server db:deploy` and start the server with
`pnpm --filter @ai-agent-workflow/server start`. The server honors Railway-style
`PORT` and binds to `HOST` or `0.0.0.0` by default.

## 硬性要求

- 不要把docs/文件夹下的文件加入git记录！
- 不要尝试绕过库的某些已有功能或者配置实现功能，去自己造轮子，真实案例：调整 ReactFlow 时，优先检查节点、边、handle 的现有配置能否解决问题；
  不要在未排查配置项前自定义渲染器或重新造轮子。
- 接入模型 provider 时，优先使用对应官方/维护良好的 SDK 或 LangChain
  集成包，例如 `@langchain/deepseek`、`@langchain/openai`、
  `@langchain/anthropic`、`@langchain/ollama`。不要在已有库可用时手写
  Chat Completions、Anthropic Messages 或 Ollama HTTP 协议适配层。
- 不能只是写代码，还必须思考 UX：主动覆盖加载、流式、空、错误等中间状态，
  避免界面出现空白、卡死或无任何反馈；在交付前从用户视角检查交互是否顺畅。

## Packages And Apps

- `apps/web`: primary browser client.
- `apps/server`: REST API server and synchronous LangGraph runtime.
- `apps/desktop`: legacy Electron shell for the shared workbench.
- `packages/workbench-ui`: reusable React workbench.
- `packages/workflow-client`: typed REST client.
- `packages/api-contracts`: route builders, DTOs, schemas, and normalized errors.
- `packages/workflow-domain`: workflow schema, validation, serialization, and
  prompt variable helpers.
- `packages/tsconfig`: shared TypeScript presets.

## Web Homepage Theme

- Keep the web homepage header tabs and primary homepage accents aligned with
  the workbench brand color tokens (`bg-brand`, `text-brand`,
  `text-brand-foreground`, `border-brand/*`, `ring-brand/*`) instead of
  reintroducing standalone blue/sky tab treatments.
- Workflow cards on the homepage should render the saved workflow metadata icon
  through the shared workbench workflow icon renderer. Do not hard-code a fixed
  workflow card glyph when `workflow.icon` is available.
- Homepage filtering should only use real workflow summary data. Do not add tag
  chips or suggested tags unless workflow tags are persisted by the API.

## Gotchas

- Before building complex UI components, check the existing shared components
  and package exports first. Prefer reusing codebase primitives such as the
  shared workbench `Popover` instead of duplicating behavior or styling.
- The web homepage header must use a three-column CSS grid
  (`1fr auto 1fr`) so the center tabs are centered against the full viewport,
  not against the uneven left and right content widths.
- Reserve stable width for the homepage header account slot. Auth/session UI can
  render different trigger widths while pending, signed out, and signed in; that
  width change must not cause header layout shift.
- Homepage header tab buttons must keep identical box metrics in active and
  inactive states. Use transparent borders in the base state and only change
  color/background/shadow for active styling.

## Knowledge Bases (RAG)

User-level reusable Knowledge Bases feed a Knowledge node that retrieves context
for downstream LLM nodes (semantic vector search). Anonymous visitors land on a
seeded read-only Chinese customer-support demo (`云舵客服知识库`) and can run the
Start → Knowledge → LLM flow without signing in; authenticated users can create
KBs and add pasted text or `.txt`/`.md` files.

- **Deployment**: requires Postgres with the `pgvector` extension (e.g. Railway
  Postgres) for stored chunk embeddings.
- **Embedding env** (`apps/server`): `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`,
  `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY` (falls back to `CREDITS_OPENAI_API_KEY`),
  and `KNOWLEDGE_INDEXER_CONCURRENCY`. See `apps/server/.env.example`. Any
  OpenAI-compatible `/embeddings` endpoint works (model name passed through, no
  `dimensions` param sent — the model's default dimension is used). `EMBEDDING_BASE_URL`
  must be reachable **from the server's own runtime**: a local `127.0.0.1:11434` Ollama
  is fine for `pnpm dev` but not on a hosted deploy (e.g. Railway) — there, point it at a
  hosted endpoint (OpenAI, SiliconFlow, DashScope, …). With no key configured,
  `getPlatformEmbeddingConfig()` returns null, no embedding adapter is built, and Knowledge
  nodes fail at runtime with "Embedding adapter is not configured for Knowledge retrieval."
- **Active embedding surfaced to the UI**: `GET /api/embedding-info` (public,
  non-sensitive) reports the configured `{ provider, model }` (or `null` when unset).
  The KB create dialog reads it to show the real embedding model instead of a hardcoded
  one, including an explicit "not configured" state. Creating a KB **stamps** that
  provider/model into the KB's persisted `settings.embedding` so its metadata records the
  model it was indexed with; this is applied only on create — read views keep each KB's
  own recorded value even if the server env later changes.
- **MVP limits**: 20 documents per KB, 100k characters per document, and 500k
  characters total per account.
- **Deferred**: PDF/DOCX/webpage ingestion, keyword/hybrid retrieval, reranking,
  and user-selected embedding providers/models are reserved in the schema/API but
  not enabled in the MVP.
- **Destructive actions require confirmation**: deleting a knowledge base (or a
  document) must go through an explicit confirm step in the UI — never delete on a
  single click. Use the shared inline confirmation pattern (confirm + cancel),
  matching `WorkflowSwitcher`/`RunHistoryMenu`.

## AI Credits

Platform-funded "AI credits" let users run paid providers without their own API
key. Credentials are deployment secrets, one per provider, read from env as
`CREDITS_<PROVIDER>_API_KEY` (base URL forced to the official endpoint, optionally
overridden with `CREDITS_<PROVIDER>_BASE_URL`). The MVP funds **DeepSeek only**.

- **Per-user grant**: a single auto-approved grant of 100k tokens (input +
  output), metered down per credits run.
- **Platform-wide daily cap**: across *all* users, AI-credits runs may produce at
  most **1,000,000 output tokens per UTC day** by default — overridable with the
  optional `DAILY_OUTPUT_TOKEN_LIMIT` env var — tracked in `platform_daily_usage`.
  New credits runs are refused with
  `daily_limit_exceeded` once spent, and an in-flight run is stopped if it crosses
  the ceiling. Runs on a user's own API key are **not** counted. The cap resets at
  UTC midnight; users can switch to an API key to keep working.
- **Provider availability**: `GET /api/credit-providers` (public, non-sensitive)
  reports which providers have a platform key configured. The model selector only
  offers the "AI Credits" option for those providers; every other provider shows
  API-key-only.

## Known Limits

- Production graph execution beyond the supported Start, Knowledge, LLM, Tool,
  and Agent subset is deferred.
- The Agent node (`type: "agent"`) runs a bounded, model-driven tool-calling
  loop over an inline Agent Tool List. Only the **Function Calling** strategy is
  implemented (requires a tool-calling-capable model); **ReAct** is selectable in
  the inspector but surfaces a clear "not implemented" error. See
  `docs/adr/0005-agent-node-inline-tools-function-calling.md`.
- Tools are registry-based (one `tool` node bound to a chosen tool, or several
  picked inline into an Agent Tool List; see
  `docs/adr/0003-generic-tool-node-and-tool-registry.md`). Built-in tools are
  Current Time and Send Email. **MCP tools are implemented** as an account-level
  Tool Registry provider — remote **HTTP** servers registered per user with
  **Headers** auth, snapshotted into the Tool Browser MCP tab and pickable into a
  Tool node or an Agent Tool List (see
  `docs/adr/0004-mcp-as-account-level-tool-registry-provider.md`). MCP **OAuth /
  Configurations**, **stdio** transport, and **resources/prompts-as-tools** are
  deferred; **Custom (API)** and **Workflow-as-tool** providers remain reserved
  placeholders.
- A read-only **Built-in MCP Server** (ADR 0006) is hosted by the app and available
  to **everyone, including anonymous visitors** — no registration, no secrets. Its
  demo tools appear in the Tool Browser MCP tab and execute live over the real MCP
  transport, the MCP analogue of the seeded example Knowledge Base. Registering your
  *own* MCP server still requires signing in.
- MCP header secrets are encrypted server-side and never written into workflow
  JSON or exports; anonymous (signed-out) users cannot register an MCP server.
- Anonymous Knowledge runs are limited to the seeded read-only example KB;
  anonymous uploads are not supported.
- Knowledge ingestion is pasted text and `.txt`/`.md` files only; PDF/DOCX,
  hybrid retrieval, and user-managed embedding providers are deferred.
- Indexing runs in-process with low concurrency; no Redis, BullMQ, separate
  worker, or external vector database is used.
- Desktop file open/save parity is intentionally out of scope for this migration.
