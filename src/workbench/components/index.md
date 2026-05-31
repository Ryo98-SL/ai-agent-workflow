# Workbench Components Index

## Purpose

This directory contains focused React components for the MVP workbench shell.

## Key Files

- `DebugPanel.tsx` handles run controls, test variables, and runtime result rendering.
- `ModelSettingsPanel.tsx` edits OpenAI-compatible base URL, model, and in-memory API key.
- `NodeInspector.tsx` selects the inspector for the active node type.
- `NodePalette.tsx` adds schema nodes to the workflow.
- `ProjectFileActions.tsx` provides file commands through callbacks from `AppWorkbench`.
- `WorkflowCanvas.tsx` adapts persisted workflow nodes and edges into ReactFlow, including node selection, larger connection handles, edge creation, and visible MiniMap node styling.
- `inspectors/` contains node-specific configuration forms.
