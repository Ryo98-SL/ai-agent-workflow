# Source Module Index

## Purpose

`src` contains the Electron renderer application and domain logic for the AI Agent Workflow MVP.

## Structure

- `main.tsx` mounts the React workbench and imports ReactFlow/Tailwind styles.
- `styles.css` contains Tailwind directives and base page styles.
- `domain/` contains workflow schema and runtime adapter logic.
- `workbench/` contains UI state, layout, canvas, inspectors, file actions, and debug output.
- `vite-env.d.ts` declares Vite and preload bridge types.

## Notes

Renderer code does not read or write local files directly. File persistence goes through `window.agentWorkflow`, which is exposed by the Electron preload script.
