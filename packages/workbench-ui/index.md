# Workbench UI Package Index

## Purpose

`packages/workbench-ui` owns the browser-compatible workflow editor and run
inspection UI.

## Structure

- `src/index.ts` exports the public workbench component and types.
- `src/styles.css` provides Tailwind and base document styles.
- `src/workbench/` contains the workbench state container, UI types, and panels.
- `tests/` contains component smoke coverage against a mocked workflow API.

## Behavior

The workbench loads the first server workflow on mount, can create new local
drafts, saves workflows through the injected API, and creates mock runs through
the same API. Run results render the server's workflow run output and events.
