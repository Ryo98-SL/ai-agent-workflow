# Workbench Module Index

## Purpose

`packages/workbench-ui/src/workbench` owns the reusable workbench experience.

## Structure

- `AppWorkbench.tsx` is the top-level workflow state container, API boundary
  caller, and layout shell.
- `types.ts` defines workbench UI state and the injected workflow API contract.
- `components/ProjectFileActions.tsx` exposes new/open/save/save-as controls.
- `components/NodePalette.tsx` lists the MVP node family.
- `components/WorkflowCanvas.tsx` wires ReactFlow nodes, workflow-backed edges,
  selection, live dragging, explicit node dimensions/handle bounds, larger
  connection handles, MiniMap styling, and a structure-only remount key that
  avoids viewport jumps after drag persistence. Edge selection is local UI
  state, and Delete/Backspace edge removal is persisted to the workflow graph.
- `components/ModelSettingsPanel.tsx` edits OpenAI-compatible settings.
- `components/NodeInspector.tsx` routes selected nodes to the correct inspector.
- `components/inspectors/` contains LLM, Tool, and unsupported-node inspector views.
- `components/DebugPanel.tsx` triggers server-backed mock runs and displays run
  output/events.

## Behavior

The first screen is the workbench. The UI loads and saves workflows through an
injected workflow API. LLM and Current Time Tool selections can trigger a
server-backed mock workflow run. Other node types stay visible as schema
placeholders.
