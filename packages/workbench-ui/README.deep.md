# Workbench UI Deep README

## Architecture

`packages/workbench-ui` owns the browser-compatible workbench UI. It imports
workflow schemas and run DTO types, but not Electron globals, server internals,
or runtime execution adapters.

Core responsibilities:

- `src/index.ts` exports the public component and API boundary types.
- `src/workbench/AppWorkbench.tsx` owns workflow state, panel visibility,
  initial server loading, persistence calls, graph undo/redo ownership, and
  workflow-level run calls.
- `src/workbench/workflowDirtySnapshot.ts` owns the canonical content snapshot
  used for Save button dirty state.
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
- ReactFlow's built-in Controls are not used; the canvas owns bottom-right
  shadcn button groups under the MiniMap for history and viewport actions so
  styling stays aligned with the workbench.
- Source-handle palette additions create outgoing edges; target-handle additions
  create incoming edges and cannot create End nodes.
- Hovering a node highlights only its directly connected edges and remains local
  UI state.
- Inspector edits update node data without viewport resets or selection bounce.
- The node inspector owns node identity editing in the panel header and
  description area, then separates node settings from selected-node run history
  with tabs. History uses compact English-format date + duration rows and
  reuses the same node-output detail renderer as the debug panel without
  repeating the selected node icon or label. During a workflow run, the
  inspector forces History active, disables Settings, and opens the latest
  history row.
- Canvas undo/redo is operation-level and structural only: it covers node/edge
  creation, deletion, and node movement, but not inspector edits, LLM model
  overrides, global model settings, panel state, or run state.
- Save activation compares the current canonical workflow content snapshot with
  the last opened/saved baseline. The snapshot ignores `metadata.updatedAt` and
  transient workflow-level `modelProvider.apiKey`, so undo/redo and save
  round-trips can return the button to the correct disabled state.
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
preload APIs, or local runtime adapters. The test setup includes small DOM
polyfills for ReactFlow sizing and a minimal EventSource mock for stream-based
run rendering. Shared run output components should be exercised through the
debug panel or node inspector paths rather than duplicated in separate fixtures.
