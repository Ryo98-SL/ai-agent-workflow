# AI Agent Workflow

Web-first monorepo for debugging AI agent workflow graphs.

## Shipped MVP

- Primary Vite React web app in `apps/web`.
- Legacy Electron shell in `apps/desktop` that wraps the same web-first workbench.
- Reusable workbench UI package with node palette, ReactFlow canvas, inspectors,
  server-backed save/load, model provider selection, and run rendering.
- Durable workflow schema package with Start, LLM, Knowledge, Tool, Code,
  If/Else, Template, and End nodes.
- Shared REST/Zod API contracts, a deterministic Hono server with LangGraph
  Start-to-LLM runs, and a typed fetch workflow client.
- Legacy local runtime adapters remain covered by tests, but the primary
  workbench now runs through the workflow API boundary.

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

`pnpm dev` starts the API server at `http://127.0.0.1:8788` and the web app
at `http://127.0.0.1:5173`. The web and desktop renderers use
`VITE_WORKFLOW_API_BASE_URL` when a different API origin is needed.
- 不要把docs/文件夹下的文件加入git记录！
- 调整 ReactFlow 时，优先检查节点、边、handle 的现有配置能否解决问题；
  不要在未排查配置项前自定义渲染器或重新造轮子。

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

## Known Limits

- Production graph execution beyond the supported Start-to-LLM subset is
  deferred.
- Tool calls, durable run history, and secret storage are not yet server-owned
  production systems.
- Auth, authorization, database persistence, queues, retries, and hosted secret
  management are deferred.
- Desktop file open/save parity is intentionally out of scope for this migration.
