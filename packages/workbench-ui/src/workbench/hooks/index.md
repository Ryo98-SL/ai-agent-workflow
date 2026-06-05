# Workbench Hooks Index

## Purpose

Stateful workbench hooks that keep runtime concerns outside visual components.

## Key Files

- `useWorkflowExecution.ts` starts workflow runs, follows the run event stream,
  and exposes node execution state for the canvas and debug panel.
- `useWorkflowGraphHistory.ts` owns local undo/redo stacks for canvas structure
  operations without snapshotting node inspector configuration or global model
  settings.

## Behavior

Hooks in this folder are workbench-local. They may depend on the injected
workflow API and durable workflow-domain types, but they should not reach into
ReactFlow components directly. Canvas components translate user gestures into
workflow-level events; hooks own cross-component state transitions.
