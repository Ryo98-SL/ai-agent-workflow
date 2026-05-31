# AI Agent Workflow

Local Electron + React workbench for debugging AI agent workflow nodes.

## Shipped MVP

- Dify/Coze-style desktop workbench with node palette, ReactFlow canvas, inspector, and debug panel.
- Durable `.agentflow.json` schema with Start, LLM, Knowledge, Tool, Code, If/Else, Template, and End nodes.
- First-class LLM node debugging against an OpenAI-compatible `/chat/completions` endpoint.
- Prompt variable detection and resolution with normalized missing-variable errors.
- Preload-safe Electron open/save/save-as workflow file APIs.
- Built-in Current Time Tool adapter through the same runtime boundary as LLM execution.
- API keys are used only in renderer memory for runs and are omitted from saved workflow files.

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm lint
pnpm smoke
pnpm build
```

`pnpm dev` starts Vite at `http://127.0.0.1:5173/` and launches Electron.

If Electron download times out on GitHub, run:

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

## Known Limits

- Full graph execution and LangGraph compilation are deferred.
- Knowledge, Code, If/Else, Template, and End nodes are schema-visible but not executable.
- API keys are not stored in keychain yet.
- Tool support is limited to the built-in Current Time adapter.
