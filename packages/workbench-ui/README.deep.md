# Workbench UI Deep README

## Architecture

`packages/workbench-ui` owns the browser-compatible workbench UI. It imports
workflow schemas and run DTO types, but not Electron globals, server internals,
or runtime execution adapters.

Core responsibilities:

- `src/index.ts` exports the public component and API boundary types.
- `src/workbench/AppWorkbench.tsx` owns workflow state, panel visibility,
  initial server loading, persistence calls, and workflow-level run calls.
- `src/workbench/components` owns the canvas-first shell, popovers, inspectors,
  model settings, node palette, run panel, and ReactFlow adapters.
- `src/workbench/assets` stores bundled DeepSeek, OpenAI, Anthropic, and
  Ollama provider logos so model UI never depends on external image URLs at
  runtime.
- `src/styles.css` exposes Tailwind/base styles for consuming apps.
- `tests/core-loop.test.tsx` covers the end-to-end UI loop with a mocked API.

Design constraints:

- The layout waits for the server workflow before mounting the canvas, avoiding
  a placeholder graph flash.
- Popovers use the shared Floating UI wrapper and mount under `body`.
- ReactFlow nodes keep explicit dimensions and handle bounds; dynamic Start and
  LLM content, including provider-logo sizing, must not shift handle positions.
- Source-handle palette additions create outgoing edges; target-handle additions
  create incoming edges and cannot create End nodes.
- Hovering a node highlights only its directly connected edges and remains local
  UI state.
- Inspector edits update node data without viewport resets or selection bounce.
- Edge selection is local UI state; edge deletion persists back to the workflow
  graph.
- DeepSeek is the normal model-settings fallback. OpenAI and Anthropic are
  selectable cloud providers. Ollama is hidden unless the host enables
  development providers. Workflow-level API keys are stored in the provider
  keyring, while LLM node overrides can carry their own API key and advanced
  sampling settings.

## Test Strategy

Component tests render the full workbench with a memory workflow API. They
should cover user-visible behavior and API calls without browser fetch, Electron
preload APIs, or local runtime adapters.
