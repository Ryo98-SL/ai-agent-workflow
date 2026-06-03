# Workbench Module Index

## Purpose

`packages/workbench-ui/src/workbench` owns the reusable workbench experience.

## Structure

- `AppWorkbench.tsx` is the top-level workflow state container, API boundary
  caller, initial server-load gate, and floating panel visibility owner.
- `types.ts` defines workbench UI state and the injected workflow API contract.
- `components/WorkbenchLayout.tsx` renders the canvas-first shell, header
  actions, node palette popover, model settings popover, selection-driven
  inspector panel, and top-right run log popover.
- `components/InlineNodePalettePopover.tsx` renders the node-handle anchored
  node palette used to create and connect a node from an existing handle.
- `components/FloatingPanel.tsx` provides the shared framed popover/panel
  surface used by the layout shell.
- `components/ProjectFileActions.tsx` exposes new/open/save/save-as controls.
- `components/NodePalette.tsx` lists the MVP node family inside the palette
  popover and disables adding a second Start node.
- `components/WorkflowCanvas.tsx` wires ReactFlow nodes, workflow-backed edges,
  selection, live dragging, explicit node dimensions/handle bounds, larger
  connection handles, node-handle palette triggers, MiniMap styling, and a
  structure-only remount key that avoids viewport jumps after drag persistence.
  Edge selection is local UI state, and Delete/Backspace edge removal is
  persisted to the workflow graph.
- `components/ModelSettingsPanel.tsx` edits provider-aware model settings from
  the top-right settings popover through a searchable provider/model selector.
- `components/NodeInspector.tsx` routes selected nodes to the correct inspector
  when the selection panel is visible.
- `components/inspectors/` contains Start, LLM, Tool, and unsupported-node inspector views.
- `components/DebugPanel.tsx` renders Start input controls, triggers
  workflow-level server runs, and displays run output/events.

## Behavior

The first screen waits for the injected workflow API to return or create the
server workflow before mounting the workbench canvas, avoiding a flash of the
default placeholder graph. The UI then loads and saves workflows through that
API. The palette and model settings are opened from rounded floating/header
buttons, while node handle add buttons open a palette beside the handle. Source
handle additions connect the clicked node to the created node; target handle
additions connect the created node into the clicked node and disable End
creation. Selecting a node opens the inspector without opening run output.
The top-right Run workflow control opens a run panel with Start-declared inputs
and submits workflow-level runs through the injected API. DeepSeek is available
in model settings by default; Ollama appears only when the host app enables
development model providers. Other node types stay visible as schema
placeholders.
