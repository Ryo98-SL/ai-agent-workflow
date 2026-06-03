# Workbench Components Index

## Purpose

Focused React components for the server-backed workbench shell.

## Key Files

- `WorkflowCanvas.tsx` adapts workflow nodes and edges to ReactFlow, preserving
  controlled node data, selection, drag persistence, fixed handle bounds,
  MiniMap styling, active model/provider data, hover edge highlighting, and
  direction-aware handle palette creation.
- `modelCatalog.ts` is the local source for selectable providers, model IDs,
  and chat/image capability metadata.
- `modelProviderVisuals.tsx` maps provider names to bundled logo assets and
  normalizes their mixed source dimensions in the model UI.
- `WorkbenchLayout.tsx` owns the canvas-first shell and panel placement.
- `Popover.tsx` and `FloatingPanel.tsx` provide the shared body-level floating
  surfaces. `Popover` supports `matchReferenceWidth` and `fillAvailableHeight`
  (the latter uses the floating-ui `size` middleware to stretch the panel from
  the trigger down to the viewport edge, recomputed on every reposition).
- `InlineNodePalettePopover.tsx` anchors node creation to a ReactFlow handle.
- `ModelSettingsEditor.tsx` is the reusable provider/model/base URL/API key
  editor shared by global settings and LLM node overrides.
- `ModelSettingsPanel.tsx` edits workflow-level provider-aware settings and the
  provider keyring. DeepSeek is the fallback; OpenAI and Anthropic are
  available by default; Ollama is development-only.
- `DebugPanel.tsx` gathers Start inputs, triggers runs, and renders streaming
  run progress: a persistent run-status header (running/succeeded/failed
  variants) plus per-node cards that show the node icon, duration, status, live
  LLM text, and collapsible Input / Process Data / Out Data JSON sections.
- `JsonViewer.tsx` is a read-only Monaco editor for inspecting JSON payloads
  with syntax highlighting; height auto-fits content up to a cap, then scrolls.
- `NodeInspector.tsx` selects the inspector for the active node type when a node is selected.
- `NodePalette.tsx` lists creatable schema nodes and prevents duplicate Start.
- `ProjectFileActions.tsx`, `Button.tsx`, `inspectors/`, and `workflowNodes/`
  contain focused controls, forms, and node renderers.

## Constraints

ReactFlow handles must stay aligned with explicit layout bounds. Inspector edits
should update node cards without viewport resets. LLM node model-setting edits
should update the node override and effective card logo without changing
workflow defaults. Edge selection is local, but edge/node deletion must persist
graph changes. All anchored popovers should use the shared body-level popover
path.
