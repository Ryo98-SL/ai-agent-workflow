# Workbench Module Index

## Purpose

Reusable workbench state, layout, and canvas runtime.

## Structure

- `AppWorkbench.tsx` owns workflow state, API calls, active local/server API
  selection, initial load gating, content-snapshot dirty state, New Workflow
  template loading, Chat Mode dispatch, provider-key preparation, run request
  workflow snapshots, workflow-scoped Debug Session selection, active workflow id
  sync callbacks, browser document title synchronization, and floating panel
  visibility.
- `types.ts` defines workbench UI state and the injected workflow API contract.
- `dateFormat.ts` owns shared Product Locale-aware date formatting for
  user-visible workbench timestamps.
- `components/` contains the layout shell, header home link, ReactFlow canvas,
  popovers, palette, inspectors, Knowledge Base management, Tool Browser,
  variable-rich text editor, model settings, project actions, Chat Panel, and
  run panel.
- `hooks/` contains execution streaming, resizable panel width, and graph
  history hooks.
- `workflowDirtySnapshot.ts` creates stable workflow content snapshots for the
  header Save button state, ignoring workflow metadata and transient
  workflow-level API keys.
- `assets/` contains bundled DeepSeek, OpenAI, Anthropic, and Ollama provider
  logos used by model UI.

## Behavior

The module waits for a server workflow before mounting the canvas. When a
visitor has no saved workflows, anonymous sessions open the seeded Chinese
customer-support RAG demo (`createKnowledgeDemoWorkflow`) so the example-KB flow
is runnable out of the box, while signed-in users start from the neutral
default or a selected template from the New Workflow dialog. Selection opens
inspection; explicit run requests open run output. Handle palettes wire
new nodes by handle direction, and target-handle palettes disable End. Model
settings expose DeepSeek, OpenAI, and Anthropic by default, with Ollama behind
the development-provider flag. When that flag is off, legacy Ollama settings are
displayed and edited through the DeepSeek fallback so production UI does not
surface local-provider options. Provider API keys live in the workflow keyring,
and LLM node Model Setting popovers can override provider, model, API key,
temperature, and max tokens while the canvas displays the resolved effective
model. Knowledge Base management opens from the Settings popover, and Knowledge
nodes select reusable KBs from the inspector while showing retriever output
variables. Canvas undo/redo covers structural graph edits only: adding/removing
nodes, adding/removing edges, and moving nodes. Inspector edits, node model
overrides, global model settings, selection, panels, and run state are not part
of graph history. Header Save activation is derived by comparing the current
stable workflow content snapshot with the last opened/saved baseline, so
undo/redo can return the button to the correct enabled state without coupling
dirty state to history stack length. Header saves set a pending state and
synchronous guard before calling the injected workflow API, so the Save button
shows loading feedback, disables immediately, and cannot issue duplicate save
requests; save failures also emit the shared toast while preserving debug error
state. While that dirty state holds, a `beforeunload` guard warns before the tab
closes or navigates away so unsaved work is not lost. Workflow title,
description, and icon edits
stay local to the metadata editor until its own Save button persists them.
Header run history opens a portal-mounted right drawer
with read-only debug output beside a date-first run list; run deletion uses an
inline confirmation step with the same row height and refreshes the workflow run
query. Non-MVP node types remain visible schema placeholders.

Chat Mode uses the same workflow graph with `workflow.settings.mode = "chat"`.
`useWorkflowExecution` maintains workflow-scoped Debug Sessions: latest debug
state, node execution state, conversation id, transcript, turn count, SSE
subscription, and Human Input resume flow. Switching workflows restores that
workflow's session or an empty debug panel when none exists; in-flight runs keep
streaming into their owning workflow session while another workflow is open.
Before one-shot or Chat Mode execution, `AppWorkbench` persists dirty changes and
includes the current workflow snapshot in the run request so the server executes
the provider and node settings visible in the editor. Production snapshots also
replace hidden development providers such as Ollama with the DeepSeek fallback
shown in model fields and node cards.
Tool nodes bind to descriptors from workflow-domain and can be created from
either the left palette or a handle palette. Variable-bearing fields render
Lexical chips but store the canonical template string.

Host applications may pass `initialWorkflowId` and `onWorkflowIdChange` to keep
their own URL or navigation state aligned with the workbench's active workflow.
They may also pass `homeHref` for the header back button, which defaults to `/`.
After the active workflow has loaded, `AppWorkbench` keeps `document.title`
aligned with `workflow.metadata.name`, including workflow switches and metadata
editor saves.
Template creation uses Product Locale as Template Locale for new workflow
defaults only; after creation, workflow names, node labels, prompts, and field
defaults are ordinary User-authored Content.
