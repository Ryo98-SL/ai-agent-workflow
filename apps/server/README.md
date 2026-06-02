# Workflow API Server

Minimal Hono server for workflow persistence and synchronous Start-to-LLM
workflow runs compiled through LangGraph JS.

```bash
pnpm --filter @ai-agent-workflow/server dev
```

The local server listens on `http://127.0.0.1:8788` by default. Set `PORT` to
override the port.

Workflow runs require OpenAI-compatible model settings on the workflow. The
server posts chat completion requests to `<baseURL>/chat/completions` and keeps
run records/events in memory.
