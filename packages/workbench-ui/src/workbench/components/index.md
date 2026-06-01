# Workbench Components Index

## Purpose

This directory contains focused React components for the server-backed
workbench shell.

## Key Files

- `DebugPanel.tsx` handles run controls, test variables, and server run result
  rendering.
- `ModelSettingsPanel.tsx` edits OpenAI-compatible base URL, model, and in-memory API key.
- `NodeInspector.tsx` selects the inspector for the active node type.
- `NodePalette.tsx` adds schema nodes to the workflow.
- `ProjectFileActions.tsx` provides new/open/save/save-as commands through
  callbacks from `AppWorkbench`.
- `WorkflowCanvas.tsx` adapts persisted workflow nodes and workflow-backed edges
  into ReactFlow, including node selection, live dragging, explicit node
  dimensions/handle bounds, larger connection handles, edge creation, and
  visible MiniMap node styling. The ReactFlow remount key excludes node
  positions so drag-stop persistence does not reset the viewport. Edge
  selection stays local, while Delete/Backspace removal updates the workflow.
- `inspectors/` contains node-specific configuration forms.
