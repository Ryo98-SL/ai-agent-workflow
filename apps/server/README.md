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
uses LangChain chat model modules for DeepSeek and Ollama, then keeps run
records/events in memory. Run requests can provide transient model settings,
including a DeepSeek API key, for execution without storing that key on the
workflow.

Route handling and runtime execution emit structured JSON logs through the
shared `src/logger.ts` module. Log metadata is limited to safe identifiers and
summaries, avoiding API keys, full prompts, and full input payloads.
