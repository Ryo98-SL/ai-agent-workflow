# Workbench Module Index

## Purpose

Reusable workbench state, layout, and canvas runtime.

## Structure

- `AppWorkbench.tsx` owns workflow state, API calls, initial load gating,
  content-snapshot dirty state, and floating panel visibility.
- `types.ts` defines workbench UI state and the injected workflow API contract.
- `components/` contains the layout shell, ReactFlow canvas, popovers, palette,
  inspectors, model settings, project actions, and run panel.
- `hooks/` contains execution streaming and graph history hooks.
- `workflowDirtySnapshot.ts` creates stable workflow content snapshots for Save
  button state, ignoring timestamp churn and transient workflow-level API keys.
- `assets/` contains bundled DeepSeek, OpenAI, Anthropic, and Ollama provider
  logos used by model UI.

## Behavior

The module waits for a server workflow before mounting the canvas. Selection
opens inspection; explicit run requests open run output. Handle palettes wire
new nodes by handle direction, and target-handle palettes disable End. Model
settings expose DeepSeek, OpenAI, and Anthropic by default, with Ollama behind
the development-provider flag. Provider API keys live in the workflow keyring,
and LLM node Model Setting popovers can override provider, model, API key,
temperature, and max tokens while the canvas displays the resolved effective
model. Canvas undo/redo covers structural graph edits only: adding/removing
nodes, adding/removing edges, and moving nodes. Inspector edits, node model
overrides, global model settings, selection, panels, and run state are not part
of graph history. Save activation is derived by comparing the current stable
workflow content snapshot with the last opened/saved baseline, so undo/redo can
return the button to the correct enabled state without coupling dirty state to
history stack length. Non-MVP node types remain visible schema placeholders.
