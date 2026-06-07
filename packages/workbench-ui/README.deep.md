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
- Popovers use the shared Floating UI wrapper and mount under `body`; the
  header run history uses a backdrop-protected right drawer because it combines
  historical debug output and a selectable/deletable run list.
- User-visible dates must use the shared `formatWorkbenchDate` helper, not
  browser-default locales, so run history stays English even when the OS/browser
  locale is Chinese.
- ReactFlow nodes keep explicit dimensions and handle bounds; dynamic
  description, Start, and LLM content, including provider-logo sizing, must not
  shift handle positions.
- ReactFlow's built-in Controls are not used; the canvas owns bottom-right
  shadcn button groups under the MiniMap for history and viewport actions so
  styling stays aligned with the workbench.
- Source-handle palette additions create outgoing edges; target-handle additions
  create incoming edges and cannot create End nodes.
- Hovering a node highlights only its directly connected edges and remains local
  UI state.
- Inspector edits update node data without viewport resets or selection bounce.
- Header run history keeps historical debug details and the run list in one
  drawer container. The left pane reuses the read-only Debug Panel; the right
  pane shows date-first run rows with status icons and an inline delete confirm
  step. Keep the drawer portal-mounted under `document.body`, inset from the
  viewport as a rounded panel, and split the detail/list panes with `gap` rather
  than a touching border. History rows and confirm rows must use the same fixed
  height to avoid layout shift, row hover backgrounds must have vertical spacing
  between them, and raw run IDs should not be shown in the UI.
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
- Header Save activation compares the current canonical workflow content
  snapshot with the last opened/saved baseline. The snapshot ignores workflow
  metadata and transient workflow-level `modelProvider.apiKey`; title,
  description, and icon changes are saved from `WorkflowMetaEditor` instead of
  activating the header Save button.
- Workflow switcher rows use the saved workflow summary icon, not a fixed icon,
  and keep row metadata editing adjacent to row deletion inside the popover.
- Edge selection is local UI state; edge deletion persists back to the workflow
  graph.
- DeepSeek is the normal model-settings fallback. OpenAI and Anthropic are
  selectable cloud providers. Ollama is hidden unless the host enables
  development providers. Workflow-level API keys are stored in the provider
  keyring and selected from provider groups; LLM node overrides reuse the same
  model settings panel and carry provider/model/endpoint plus advanced sampling
  settings, but not inline API keys. API-key creation uses the shared
  no-animation dialog, whose close affordance is rendered through the workbench
  `Button` component. Model search temporarily expands matching provider groups,
  and nested provider-key popovers should dismiss when users click elsewhere in
  the selector.

## Test Strategy

Component tests render the full workbench with a memory workflow API. They
should cover user-visible behavior and API calls without browser fetch, Electron
preload APIs, or local runtime adapters. The test setup includes small DOM
polyfills for ReactFlow sizing and a minimal EventSource mock for stream-based
run rendering. Shared run output components should be exercised through the
debug panel or node inspector paths rather than duplicated in separate fixtures.
