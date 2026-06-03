# Workflow API Server Index

## Purpose

`apps/server` owns the server-side REST surface for workflow persistence and
synchronous supported workflow execution.

## Structure

- `src/app.ts` builds the Hono app, validates requests, stores workflows/runs in
  memory, applies transient run model-provider settings for execution, and
  returns normalized contract responses.
- `src/logger.ts` exposes the shared structured logger used by route and
  runtime modules.
- `src/runtime/` compiles the supported Start/LLM subset into LangGraph,
  materializes Start input values, resolves prompt variables, calls LangChain
  DeepSeek/Ollama chat models, and returns structured node output data through a
  folder entrypoint.
- `src/index.ts` exports server public APIs and starts the local Node server for
  `pnpm --filter @ai-agent-workflow/server dev`.
- `tests/routes.test.ts` covers route behavior, LangGraph run success, required
  field/default/null semantics, prompt/model failures, unsupported reachable
  nodes, and deterministic event order.

## Behavior

The app starts with one seed workflow. Create/update routes validate full
workflow files. Run creation executes synchronously for workflows with exactly
one Start node and reachable LLM nodes, applying any run-scoped model settings
without storing them, then stores succeeded or failed run records with stable
logs, structured node outputs, and events.

Route and runtime modules emit structured JSON logs through `src/logger.ts`.
Log metadata includes safe execution identifiers and summaries, but avoids API
keys, full prompts, and full run inputs.
