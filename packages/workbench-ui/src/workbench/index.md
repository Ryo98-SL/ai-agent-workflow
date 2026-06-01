# Workbench Module Index

## Purpose

`packages/workbench-ui/src/workbench` owns the reusable workbench experience.

## Structure

- `AppWorkbench.tsx` is the top-level workflow state container, API boundary
  caller, and floating panel visibility owner.
- `types.ts` defines workbench UI state and the injected workflow API contract.
- `components/WorkbenchLayout.tsx` renders the canvas-first shell, header
  actions, node palette popover, model settings popover, selection-driven
  inspector panel, and top-right run log popover.
- `components/FloatingPanel.tsx` provides the shared framed popover/panel
  surface used by the layout shell.
- `components/ProjectFileActions.tsx` exposes new/open/save/save-as controls.
- `components/NodePalette.tsx` lists the MVP node family inside the palette
  popover.
- `components/WorkflowCanvas.tsx` wires ReactFlow nodes, workflow-backed edges,
  selection, live dragging, explicit node dimensions/handle bounds, larger
  connection handles, MiniMap styling, and a structure-only remount key that
  avoids viewport jumps after drag persistence. Edge selection is local UI
  state, and Delete/Backspace edge removal is persisted to the workflow graph.
- `components/ModelSettingsPanel.tsx` edits OpenAI-compatible settings from the
  top-right settings popover.
- `components/NodeInspector.tsx` routes selected nodes to the correct inspector
  when the selection panel is visible.
- `components/inspectors/` contains LLM, Tool, and unsupported-node inspector views.
- `components/DebugPanel.tsx` triggers server-backed mock runs and displays run
  output/events.

## Behavior

The first screen is the workbench canvas. The UI loads and saves workflows
through an injected workflow API. The palette and model settings are opened from
rounded floating/header buttons, and selecting a node opens the inspector
without opening run output. LLM and Current Time Tool selections can trigger a
server-backed mock workflow run from the canvas top-right Run control; the run
log popover opens only after Run is clicked. Other node types stay visible as
schema placeholders.
