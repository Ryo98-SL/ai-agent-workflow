# Workbench Components Index

## Purpose

Focused React components for the server-backed workbench shell.

## Key Files

- `WorkflowCanvas.tsx` adapts workflow nodes and edges to ReactFlow, preserving
  controlled node data, selection, drag persistence, fixed handle bounds,
  MiniMap styling, active model/provider data, hover edge highlighting, and
  direction-aware handle palette creation. It emits structure-level history
  entries for connect, delete, and drag-stop events instead of owning undo/redo
  stacks directly.
- `WorkflowCanvasControls.tsx` replaces ReactFlow's built-in Controls with two
  bottom-right shadcn button groups below the MiniMap: undo/redo history and
  zoom/fit/lock viewport actions. Zoom buttons disable at the configured canvas
  zoom bounds.
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
- `ModelSettingsEditor.tsx` is the reusable provider/model/endpoint/API key
  editor shared by global settings and LLM node overrides. The base URL field is
  surfaced as an optional custom API endpoint; Ollama shows a "no key" note.
- `ModelSelectorField.tsx` is a combobox over the catalog: presets are
  pick-only, and an "Add custom model" footer opens an inline form (provider +
  free-text model name) so users can run an off-catalog model through a preset
  provider. Off-catalog models render a "Custom" badge (see `isCustomModel`).
- `ProviderPicker.tsx` is a `Popover`-based provider chooser (logo per option)
  that nests safely inside another popover, unlike a portal-based native select.
- `ModelSettingsPanel.tsx` edits workflow-level provider-aware settings and the
  provider keyring. DeepSeek is the fallback; OpenAI and Anthropic are
  available by default; Ollama is development-only.
- `DebugPanel.tsx` gathers Start inputs and triggers runs. In read-only mode it
  hides the Start input/run controls and delegates historical output rendering
  to `RunOutput.tsx`.
- `RunOutput.tsx`, `RunNodeCard.tsx`, and `RunOutputPrimitives.tsx` render the
  shared latest-run surface: a persistent run-status header, filtered or full
  per-node cards, live LLM text, token counts, errors, and collapsible Input /
  Process Data / Out Data JSON sections.
- `NodeRunList.tsx` adapts run output details for the Node Inspector's History
  tab. It queries all runs for the open workflow, filters them to the active
  node, and renders English-format date + duration rows that expand into the
  same node output details without repeating the selected node icon/name. The
  newest row opens automatically, and running node rows stay open.
- `JsonViewer.tsx` is a read-only Monaco editor for inspecting JSON payloads
  with syntax highlighting; height auto-fits content up to a cap, then scrolls.
- `NodeInspector.tsx` renders the selected node inspector panel body. The
  floating panel header uses its exported editable title component for the node
  icon and label; the body provides borderless description editing and Settings
  / History tabs. Settings selects the node-type inspector, while History uses
  `NodeRunList.tsx` for the active node. Workflow runs force History active and
  disable Settings until the run leaves the running state.
- `NodePalette.tsx` lists creatable schema nodes and prevents duplicate Start.
- `ProjectFileActions.tsx` contains file controls.
- `Button.tsx`, `inspectors/`, and `workflowNodes/` contain focused controls,
  forms, and node renderers.

## Constraints

ReactFlow handles must stay aligned with explicit layout bounds. Inspector edits
should update node cards without viewport resets. LLM node model-setting edits
should update the node override and effective card logo without changing
workflow defaults. Debug Panel and Node Inspector run details should share the
same node-output detail renderer even when their outer chrome differs. Header
run history should open a separate read-only Debug Panel state, not replace the
live debug run or mutate the current workflow. Edge selection is local, but
edge/node deletion must persist graph changes through structure history. All
anchored popovers should use the shared body-level popover path.
