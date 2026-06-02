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
  popover and disables adding a second Start node.
- `components/WorkflowCanvas.tsx` wires ReactFlow nodes, workflow-backed edges,
  selection, live dragging, explicit node dimensions/handle bounds, larger
  connection handles, MiniMap styling, and a structure-only remount key that
  avoids viewport jumps after drag persistence. Edge selection is local UI
  state, and Delete/Backspace edge removal is persisted to the workflow graph.
- `components/ModelSettingsPanel.tsx` edits OpenAI-compatible settings from the
  top-right settings popover.
- `components/NodeInspector.tsx` routes selected nodes to the correct inspector
  when the selection panel is visible.
- `components/inspectors/` contains Start, LLM, Tool, and unsupported-node inspector views.
- `components/DebugPanel.tsx` renders Start input controls, triggers
  workflow-level server runs, and displays run output/events.

## Behavior

The first screen is the workbench canvas. The UI loads and saves workflows
through an injected workflow API. The palette and model settings are opened from
rounded floating/header buttons, and selecting a node opens the inspector
without opening run output. The top-right Run workflow control opens a run panel
with Start-declared inputs and submits workflow-level runs through the injected
API. Other node types stay visible as schema placeholders.
