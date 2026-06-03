# Workflow API Server

Minimal Hono server for workflow persistence and synchronous Start-to-LLM
workflow runs compiled through LangGraph JS.

Runtime execution code lives in `src/runtime/`, split by graph execution,
validation, Start input materialization, prompt resolution, and model calls.

```bash
pnpm --filter @ai-agent-workflow/server dev
```

The local server listens on `http://127.0.0.1:8788` by default. Set `PORT` to
override the port.

Workflow runs require provider-aware model settings on the workflow. The server
uses workflow defaults, provider keyring values, and optional node-level model
settings to choose the provider, model, base URL, API key, temperature, and max
tokens for each LLM node. Run requests can still provide transient model
settings/keyring values for execution.

Route handling and runtime execution emit structured JSON logs through the
shared `src/logger.ts` module. Log metadata is limited to safe identifiers and
summaries, avoiding API keys, full prompts, and full input payloads.
