# Workbench UI Package Index

## Purpose

`packages/workbench-ui` owns the browser-compatible workflow editor and run
inspection UI, with React Flow treated as the main full-screen workspace.

## Structure

- `src/index.ts` exports the public workbench component and types.
- `src/styles.css` provides Tailwind and base document styles.
- `src/workbench/` contains the workbench state container, UI types, canvas-first
  layout shell, shared button and popover primitives, and panels.
- `tests/` contains component smoke coverage against a mocked workflow API.

## Behavior

The workbench loads the first server workflow on mount, can create new local
drafts, saves workflows through the injected API, and creates server workflow
runs through the same API. Node creation and model settings open as body-level
floating-ui popovers from square-rounded icon buttons, while node inspection
opens only for selected nodes. Model settings use a searchable provider/model
selector with DeepSeek available by default and Ollama shown only when
development model providers are enabled; the selector dropdown also renders as a
body-level popover. DeepSeek API keys are preserved in memory across save
responses and sent only as transient run settings. Run output appears in a
canvas top-right body-level popover only after the icon-only Run control is
clicked, and renders the server's workflow run output and events.
