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
- `knowledge/` owns Knowledge Base management and Knowledge node inspector UI;
  see `knowledge/index.md`.
- `RunHistoryMenu.tsx` owns the header run-history drawer. It uses a backdrop
  to prevent accidental canvas interaction, portals the drawer to `document.body`
  so canvas stacking contexts cannot cover it, renders an inset rounded panel
  instead of a full-height slab, renders read-only Debug Panel output in the
  larger left pane, and keeps the date-first run list plus same-height delete
  confirmation in the right pane.
- `Popover.tsx` and `FloatingPanel.tsx` provide the shared body-level floating
  surfaces. `Popover` supports `matchReferenceWidth` and `fillAvailableHeight`
  (the latter uses the floating-ui `size` middleware to stretch the panel from
  the trigger down to the viewport edge, recomputed on every reposition).
- `InlineNodePalettePopover.tsx` anchors node creation to a ReactFlow handle.
- `ModelSettingsPanel.tsx` is the unified provider/model/endpoint/Advanced
  settings surface used by both workflow defaults and LLM node overrides.
  API-key selection stays in the provider groups through
  `ProviderApiKeyControl`, not as an inline editor field.
- `ModelSelectorField.tsx` is a combobox over the catalog: presets are
  pick-only, and an "Add custom model" footer opens an inline form (provider +
  free-text model name) so users can run an off-catalog model through a preset
  provider. Searching temporarily expands matching provider groups even if the
  user collapsed them; clearing search restores the session-only collapsed
  state. Off-catalog models render a "Custom" badge (see `isCustomModel`).
- `ProviderPicker.tsx` is a `Popover`-based provider chooser (logo per option)
  that nests safely inside another popover, unlike a portal-based native select.
- `ModelSettingsEditor.tsx` is the lower-level form used by
  `ModelSettingsPanel`; keep it focused on model selection, endpoint URL, and
  Advanced sampling fields so global and node model settings cannot diverge.
- `WorkflowMetaEditor.tsx` edits workflow title, description, and icon in a
  local draft and persists them with its own Save button so metadata changes do
  not activate the header Save control. It is embedded beside each workflow row
  in `WorkflowSwitcher.tsx`.
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
  `NodeRunList.tsx` for the active node. LLM and Knowledge settings render
  output variable shapes for downstream prompt authoring. Workflow runs force
  History active and disable Settings until the run leaves the running state.
- `NodePalette.tsx` lists creatable schema nodes and prevents duplicate Start.
- `ModelSelectorField.tsx` renders the provider/model picker. Each provider group
  header is collapsible (session-only, not persisted) and hosts a
  `ProviderApiKeyControl` for that provider.
- `ProviderApiKeyControl.tsx` is the per-provider API-key control: a popover with
  a `Usage Priority` segmented toggle (`AI credits` | `API Key`, default
  credits), the list of stored keys to switch/remove, and an `Add API Key` modal
  (label + key). It reads and writes the active selection in
  `settings.providerKeyPrefs[provider]` (`providerKeyId` + `usagePriority`) and is
  backed by `useProviderKeyStore` (server keys when signed in, in-memory when
  anonymous). The trigger shows the active key label (API Key mode) or
  "AI credits". In credits mode it renders a `CreditsPanel` (apply once /
  remaining token balance / exhausted prompt, via `useCredits`/`useApplyCredits`;
  anonymous users are told to sign in). The server only injects a stored key when
  usage priority is `apiKey` (or legacy runs with no saved preference); credits
  runs are metered against the user's token grant and aborted with a
  `credits_exhausted` error once spent. The modal uses the shared no-animation
  dialog and product `Button` chrome; the key popover dismisses when focus/click
  moves elsewhere in the model selector. Ollama groups omit it.
- `WorkflowSwitcher.tsx` shows each workflow's saved icon in the popover list
  and keeps row-level edit/delete actions together on the right edge. It always
  closes the popover and delegates the switch to the parent via `onSwitch(id,
  name)`; the parent (`AppWorkbench`) switches immediately when clean, or — when
  the open workflow has unsaved changes (`dirty`) — shows `WorkflowSwitchBar`
  instead. (Per-row delete still uses the inline confirm row.)
- `WorkflowSwitchBar.tsx` is a floating, top-centered notification (absolutely
  positioned over the workbench, not in flow) shown when a switch is attempted
  with unsaved changes. It offers "Save & switch" (persist then switch) and
  "Cancel", built from the shared `Button`. State (`pendingSwitch`/`switching`)
  lives in `AppWorkbench`.
- `ProjectFileActions.tsx` contains file controls.
- `NodeOutputVariablesPanel.tsx` renders shared field/type descriptions for
  model-output node types.
- `Button.tsx`, `inspectors/`, `knowledge/`, and `workflowNodes/` contain
  focused controls, forms, and node renderers.

## Constraints

ReactFlow handles must stay aligned with explicit layout bounds. Inspector edits
should update node cards without viewport resets. LLM node model-setting edits
should update the node override and effective card logo without changing
workflow defaults. Debug Panel and Node Inspector run details should share the
same node-output detail renderer even when their outer chrome differs. Header
run history should keep historical output inside its drawer, not replace the
live debug run or mutate the current workflow. Keep history drawer panes
separated with real gap spacing, keep list hover backgrounds from touching,
avoid showing raw run IDs, and keep confirm rows the same height as normal rows.
All user-visible workbench dates should come from `formatWorkbenchDate`, never
from `Intl.DateTimeFormat(undefined, ...)`. Edge selection is local, but
edge/node deletion must persist graph changes through structure history. All
anchored popovers should use the shared body-level popover path.
