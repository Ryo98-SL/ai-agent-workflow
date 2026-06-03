# Workbench UI Deep README

## Architecture

`packages/workbench-ui` owns the reusable React workbench. It renders the node
palette, ReactFlow canvas, inspector panels, model settings, project actions,
and server run output.

- `src/index.ts` exports the public component and API boundary types.
- `src/workbench/AppWorkbench.tsx` owns workflow state, panel visibility, and
  calls to the injected workflow API for list/create/read/update and
  workflow-level run operations. It forwards the development-provider flag that
  controls whether Ollama appears in model settings, preserves in-memory
  DeepSeek API keys after save responses, and passes current model settings as
  transient run request data. It holds the workbench layout behind an initial
  server-load gate so the default workflow placeholder is never rendered before
  the backend workflow arrives. Selecting a node opens the inspector only; run
  popover visibility is driven by explicit run requests.
- `src/workbench/components` contains focused UI panels. The workflow canvas
  keeps ReactFlow nodes controlled locally for data updates while letting
  ReactFlow own selected node state, so inspector edits update canvas cards
  without viewport refits or selection bounce. Edges stay driven by the workflow
  graph, and fixed-size node types provide explicit card dimensions plus handle
  bounds so built-in connection and MiniMap rendering do not depend on
  measurement timing. Start card height can grow with fields and descriptions,
  while handles remain fixed near the top of the card so edge endpoints do not
  depend on dynamic content height. Persisted workflow node types map directly to
  ReactFlow nodeTypes, and `components/workflowNodes` keeps one icon-bearing node
  component per workflow node type plus shared type-colored icon background
  classes used by both canvas nodes and the node palette. Node handle add
  buttons open an inline node palette anchored to the ReactFlow handle element;
  selecting a node from the source-handle palette creates an edge from the
  clicked node to the created node, while selecting a node from the target-handle
  palette creates an edge from the created node into the clicked node. End nodes
  expose only a target handle, and target-handle palettes disable End creation.
  Edge selection stays local to the canvas, while edge deletes are applied back
  to the workflow graph through ReactFlow edge changes. `Button` centralizes
  workbench button sizes and
  visual variants so icon controls, model selector rows, palette items, and
  panel actions share one native button entry point. `Popover` wraps
  `@floating-ui/react` for anchored fixed positioning, viewport collision
  handling, outside dismissal, body-level `FloatingPortal` rendering, and both
  trigger-rendered and externally supplied reference elements.
  `WorkbenchLayout` renders the canvas-first shell with square-rounded floating
  node palette and model settings icon buttons, a selection-driven inspector,
  and a top-right icon-only canvas run control; the node palette, model
  settings, and run log panels render through body-level popovers instead of
  sharing the canvas layout container. `ModelSettingsPanel` renders a searchable
  provider/model selector with DeepSeek enabled by default and Ollama hidden
  unless the host app passes the development-provider flag. Its model selector
  dropdown also uses the shared body-level popover primitive. Its API key entry
  stays in memory and is omitted from saved workflow files.
- `src/styles.css` contains Tailwind directives and shared base page styles for
  consuming apps.
- `tests/core-loop.test.tsx` covers editing, Start field configuration,
  workflow-level run submission, Start uniqueness, node-handle palette creation
  with direction-aware edge wiring and target-handle End disabling, save/load,
  and server run rendering with a mocked API dependency.

## Integration Boundary

The package imports workflow schemas from `@ai-agent-workflow/workflow-domain`
and run DTO types from `@ai-agent-workflow/api-contracts`. It does not import
Electron globals, the Hono server app, or local runtime execution adapters.

## Test Strategy

Component tests render the full workbench with a memory implementation of the
workflow API. Tests assert server persistence calls, Start input submission, and
run rendering without touching browser fetch or Electron preload APIs.
