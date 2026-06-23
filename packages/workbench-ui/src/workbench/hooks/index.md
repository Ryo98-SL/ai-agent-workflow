# Workbench Hooks Index

## Purpose

Stateful workbench hooks that keep runtime concerns outside visual components.

## Key Files

- `useWorkflowExecution.ts` starts workflow runs, follows the run event stream,
  resumes Human Input pauses, manages Chat Mode conversation/transcript state,
  exposes node execution state for the canvas, debug panel, and chat panel, and
  reports run failures back to the workbench shell for user-facing toasts such
  as the AI credits application prompt.
- `useWorkflowGraphHistory.ts` owns local undo/redo stacks for canvas structure
  operations without snapshotting node inspector configuration or global model
  settings.
- `useResizableWidth.ts` owns pointer-drag width state for side panels and
  persists the chosen width to localStorage.

## Behavior

Hooks in this folder are workbench-local. They may depend on the injected
workflow API and durable workflow-domain types, but they should not reach into
ReactFlow components directly. Canvas components translate user gestures into
workflow-level events; hooks own cross-component state transitions, SSE
subscriptions, resume flows, and persisted panel affordances.
