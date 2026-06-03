# Workflow API Server

Minimal Hono server for workflow persistence and synchronous workflow runs
compiled and streamed through LangGraph JS.

Runtime execution code lives in `src/runtime/`, split by graph execution,
validation, Start input materialization, prompt resolution, and model calls.

```bash
pnpm --filter @ai-agent-workflow/server dev
```

The local server listens on `http://127.0.0.1:8788` by default. Set `PORT` to
override the port.

Workflow runs require provider-aware model settings on the workflow when an LLM
node executes. The runtime currently executes Start and LLM nodes, while other
known workflow node types are saved through placeholder builders so their state
is visible to downstream runtime code until full implementations land. The
server uses workflow defaults, provider keyring values, and optional node-level
model settings to choose the provider, model, base URL, API key, temperature,
and max tokens for each LLM node. Run requests can still provide transient model
settings/keyring values for execution.

LangGraph execution uses a shared in-memory checkpointer and runs through
`.stream()` with updates, messages, and values enabled. `executeWorkflowRuntime`
collects normalized stream events and can call an `onStreamEvent` callback,
which is the backend hook for future live progress delivery to the workbench.

Route handling and runtime execution emit structured JSON logs through the
shared `src/logger.ts` module. Log metadata is limited to safe identifiers and
summaries, avoiding API keys, full prompts, and full input payloads.
