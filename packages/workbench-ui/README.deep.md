# Workbench UI Deep README

## Architecture

`packages/workbench-ui` owns the reusable React workbench. It renders the node
palette, ReactFlow canvas, inspector panels, model settings, project actions,
and server run output.

- `src/index.ts` exports the public component and API boundary types.
- `src/workbench/AppWorkbench.tsx` owns workflow state, panel visibility, and
  calls to the injected workflow API for list/create/read/update and
  workflow-level run operations. Selecting a node opens the inspector only; run
  popover visibility is driven by explicit run requests.
- `src/workbench/components` contains focused UI panels. The workflow canvas
  lets ReactFlow own live node dragging, keeps edges driven by the workflow
  graph, and provides explicit card dimensions plus handle bounds so built-in
  connection and MiniMap rendering do not depend on measurement timing. Its
  ReactFlow remount key intentionally excludes node positions so persisting a
  completed drag does not reset the viewport. Edge selection stays local to the
  canvas, while edge deletes are applied back to the workflow graph through
  ReactFlow edge changes. `WorkbenchLayout` renders the canvas-first shell with
  floating node palette and model settings popovers, a selection-driven
  inspector, and a top-right canvas run control whose log popover appears after
  a run is requested.
- `src/styles.css` contains Tailwind directives and shared base page styles for
  consuming apps.
- `tests/core-loop.test.tsx` covers editing, Start field configuration,
  workflow-level run submission, Start uniqueness, save/load, and server run
  rendering with a mocked API dependency.

## Integration Boundary

The package imports workflow schemas from `@ai-agent-workflow/workflow-domain`
and run DTO types from `@ai-agent-workflow/api-contracts`. It does not import
Electron globals, the Hono server app, or local runtime execution adapters.

## Test Strategy

Component tests render the full workbench with a memory implementation of the
workflow API. Tests assert server persistence calls, Start input submission, and
run rendering without touching browser fetch or Electron preload APIs.
