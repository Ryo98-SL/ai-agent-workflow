# Workbench UI Package Index

## Purpose

`packages/workbench-ui` owns the browser-compatible workflow editor and run
inspection UI, with React Flow treated as the main full-screen workspace.

## Structure

- `src/index.ts` exports the public workbench component and types.
- `src/styles.css` provides Tailwind and base document styles.
- `src/workbench/` contains the workbench state container, UI types, canvas-first
  layout shell, and panels.
- `tests/` contains component smoke coverage against a mocked workflow API.

## Behavior

The workbench loads the first server workflow on mount, can create new local
drafts, saves workflows through the injected API, and creates mock runs through
the same API. Node creation and model settings open as popovers, while node
inspection opens only for selected nodes. Run output appears in a canvas
top-right popover only after the Run control is clicked, and renders the
server's workflow run output and events.
