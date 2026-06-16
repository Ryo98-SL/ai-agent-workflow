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
  and `KNOWLEDGE_INDEXER_CONCURRENCY`. See `apps/server/.env.example`.
- **MVP limits**: 20 documents per KB, 100k characters per document, and 500k
  characters total per account.
- **Deferred**: PDF/DOCX/webpage ingestion, keyword/hybrid retrieval, reranking,
  and user-selected embedding providers/models are reserved in the schema/API but
  not enabled in the MVP.
- **Destructive actions require confirmation**: deleting a knowledge base (or a
  document) must go through an explicit confirm step in the UI — never delete on a
  single click. Use the shared inline confirmation pattern (confirm + cancel),
  matching `WorkflowSwitcher`/`RunHistoryMenu`.

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
