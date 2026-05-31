# AI Agent Workflow Deep README

## Architecture

The app is a local Electron shell around a Vite React renderer.

- `electron/main.cjs` owns windows and native file dialogs.
- `electron/preload.cjs` exposes a narrow `window.agentWorkflow` API for opening and saving workflow files.
- `src/domain/workflow` owns persisted workflow schema, validation, serialization, and prompt variable utilities.
- `src/domain/runtime` owns executable node adapter interfaces and the LLM/Current Time implementations.
- `src/workbench` owns React state, ReactFlow canvas wiring, inspectors, model settings, file actions, and debug output.
- `tests` covers schema validation, prompt variable resolution, runtime adapters, workbench interactions, and the smoke loop.

## Persistence And Secrets

Workflow files are JSON and validated through Zod before loading. `serializeWorkflowFile` updates `metadata.updatedAt` and intentionally omits `settings.modelProvider.apiKey` so secrets are not forced into versioned `.agentflow.json` files.

## Runtime Boundary

`executeNode` dispatches by persisted node type. LLM execution uses an OpenAI-compatible chat completions request. Current Time execution returns formatted local adapter output. Unsupported MVP nodes return normalized runtime errors instead of pretending to execute.

## Test Strategy

- Unit tests cover schema rejection, prompt resolution, request construction, response normalization, and error normalization.
- Component tests cover workbench rendering, inspector updates, LLM execution, and Tool execution.
- `pnpm smoke` covers create/edit/run/save/reopen/tool-run behavior using mocked file IPC and mocked model responses.
