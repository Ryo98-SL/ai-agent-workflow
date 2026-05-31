# Workbench Module Index

## Purpose

`src/workbench` owns the renderer workbench experience.

## Structure

- `AppWorkbench.tsx` is the top-level workflow state container and layout shell.
- `types.ts` defines workbench-local UI state types.
- `components/ProjectFileActions.tsx` exposes new/open/save/save-as controls.
- `components/NodePalette.tsx` lists the MVP node family.
- `components/WorkflowCanvas.tsx` wires ReactFlow nodes, edges, selection, dragging, larger connection handles, and MiniMap styling.
- `components/ModelSettingsPanel.tsx` edits OpenAI-compatible settings.
- `components/NodeInspector.tsx` routes selected nodes to the correct inspector.
- `components/inspectors/` contains LLM, Tool, and unsupported-node inspector views.
- `components/DebugPanel.tsx` runs selected executable nodes and displays runtime results.

## Behavior

The first screen is the workbench. LLM and Current Time Tool nodes can run. Other node types stay visible as schema placeholders and return unsupported execution status when routed through the runtime.
