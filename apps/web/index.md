# Web App Index

## Purpose

`apps/web` is the primary browser application for the workflow workbench.

## Structure

- `src/main.tsx` wires `workflow-client` into `workbench-ui`.
- `vite.config.ts` configures Vite dev and build output.
- `index.html` hosts the React root.

## Behavior

The app connects to the local workflow API at `http://127.0.0.1:8788` unless
`VITE_WORKFLOW_API_BASE_URL` is provided.
