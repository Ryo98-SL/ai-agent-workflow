# AI Agent Workflow Deep README

## Architecture

The repository is a `pnpm` workspace orchestrated with Turborepo. `apps/web` is
the primary product target, `apps/server` provides the workflow REST/auth/runtime
API, and shared packages hold domain, contract, client, UI, and TypeScript
configuration code.

- `apps/web` mounts `@ai-agent-workflow/workbench-ui` and injects
  `@ai-agent-workflow/workflow-client`.
- `apps/server` owns workflow/account/Knowledge Base/credit routes, Prisma
  persistence for authenticated users, anonymous inline run execution, live SSE
  streams, Human Input resume, and LangGraph runtime execution.
- `apps/desktop` preserves Electron as a legacy shell around the same
  server-backed workbench.
- `packages/workbench-ui` owns React workbench state, auth/local data switching,
  panels, ReactFlow canvas wiring, API-backed or anonymous IndexedDB
  persistence, Chat Mode, Tool Browser, Knowledge Base UI, and run result
  rendering.
- `packages/workflow-client` owns browser-compatible REST calls and normalized
  client errors.
- `packages/api-contracts` owns REST path builders, Zod request/response
  schemas, DTO types, and normalized API errors.
- `packages/workflow-domain` owns persisted workflow schema, validation,
  serialization, prompt variable utilities, available-variable helpers,
  condition evaluation, Tool Registry descriptors, and starter templates.
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
execution. It receives a workflow API dependency, saves signed-in workflow files
through the REST client, stores anonymous workflows in IndexedDB, and creates
server workflow runs through the server API. Anonymous run requests include the
current workflow inline because the server has no durable copy. Workflow
serialization still strips `settings.modelProvider.apiKey` before persistence.

The server is no longer just a mock surface. Authenticated workflows, provider
keys, custom models, credit grants, Knowledge Bases, and run history are durable
through Prisma/Postgres. Live/recent run snapshots stay in memory for SSE replay
and anonymous history. Supported runs compile executable nodes with LangGraph,
stream progress over Server-Sent Events, can pause/resume on Human Input nodes,
and invoke provider-aware LangChain chat models for DeepSeek, OpenAI, Anthropic,
or Ollama.

Workbench run history has two separate views: the Node Inspector History tab
queries all runs for the active workflow and filters them to the selected node,
while the header run-history menu opens a read-only Debug Panel for that run.
The header view does not show Start inputs and does not replace the live debug
state or mutate the current workflow.

Chat Mode reuses the same workflow graph with a stable conversation id and sends
each message as `query`, available to nodes as `{{userInput.query}}`. Tool nodes
are configured through workflow-domain descriptors and currently execute
built-in Current Time and Send Email runtimes server-side. Knowledge nodes query
ready chunks from readable KBs and emit structured retrieval output for
downstream prompts.

## Test Strategy

- Root legacy tests cover the old local runtime adapters.
- `packages/workflow-domain` tests cover schema, prompt variables, available
  variables, conditions, tool registry behavior, and workflow templates.
- `packages/api-contracts`, `apps/server`, and `packages/workflow-client` tests
  cover API schemas, Hono routes, and fetch client behavior.
- `packages/workbench-ui` tests cover editing, API-backed save/load, node
  inspector behavior, graph history, dirty snapshots, shortcut focus, and mock
  run rendering with a mocked workflow API dependency.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build` run the
  monorepo validation chain.
