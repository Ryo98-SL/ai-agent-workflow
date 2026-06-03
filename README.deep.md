# AI Agent Workflow Deep README

## Architecture

The repository is a `pnpm` workspace orchestrated with Turborepo. `apps/web` is
the primary product target, `apps/server` provides the temporary mock workflow
REST API, and shared packages hold domain, contract, client, UI, and TypeScript
configuration code.

- `apps/web` mounts `@ai-agent-workflow/workbench-ui` and injects
  `@ai-agent-workflow/workflow-client`.
- `apps/server` owns deterministic in-memory workflow routes and synchronous
  LangGraph Start-to-LLM run execution.
- `apps/desktop` preserves Electron as a legacy shell around the same
  server-backed workbench.
- `packages/workbench-ui` owns React workbench state, panels, ReactFlow canvas
  wiring, API-backed persistence, and run result rendering.
- `packages/workflow-client` owns browser-compatible REST calls and normalized
  client errors.
- `packages/api-contracts` owns REST path builders, Zod request/response
  schemas, DTO types, and normalized API errors.
- `packages/workflow-domain` owns persisted workflow schema, validation,
  serialization, and prompt variable utilities.
- `packages/tsconfig` owns shared TypeScript config presets.
- `src/domain/runtime` contains legacy client-side LLM and Current Time
  adapters retained for regression coverage only.

## Local Development

Use `pnpm dev` for the normal web/server loop. It starts:

- `@ai-agent-workflow/server` on `http://127.0.0.1:8788`
- `@ai-agent-workflow/web` on `http://127.0.0.1:5173`

Run `pnpm --filter @ai-agent-workflow/desktop dev` for the legacy Electron shell.
It uses renderer port `5174` and expects the server to be running separately.

## Persistence And Runtime Boundary

The migrated workbench no longer calls Electron globals or local runtime
execution. It receives a workflow API dependency, saves workflow files through
the REST client, and creates server workflow runs through the server API.
Workflow serialization still strips `settings.modelProvider.apiKey` before
persistence.

The server remains intentionally temporary: in-memory workflows and runs are
deterministic for UI integration and tests, not production persistence or
durable execution. Supported runs compile the reachable Start/LLM subset with
LangGraph and invoke provider-aware LangChain chat models for DeepSeek or
Ollama.

## Test Strategy

- Root legacy tests cover the old local runtime adapters.
- `packages/workflow-domain` tests cover schema and prompt variables.
- `packages/api-contracts`, `apps/server`, and `packages/workflow-client` tests
  cover API schemas, Hono routes, and fetch client behavior.
- `packages/workbench-ui` tests cover editing, API-backed save/load, and mock
  run rendering with a mocked workflow API dependency.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build` run the
  monorepo validation chain.
