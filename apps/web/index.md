# Web App Index

## Purpose

`apps/web` is the primary browser application for the workflow workbench.

## Structure

- `src/main.tsx` creates the React Router instance and renders it.
- `src/routes.tsx` converts `src/pages/**/*.tsx` files into route objects.
- `src/pages/index.tsx` wires `workflow-client` into `workbench-ui`.
- `src/pages/design/` and `src/design/` contain local design-gallery routes for
  UI review.
- `src/lib/workflowApi.ts` creates the workflow REST client and exports the API
  base URL passed to the workbench auth client.
- `vite.config.ts` configures Vite dev and build output.
- `index.html` hosts the React root.

## Behavior

The app connects to the local workflow API at `http://127.0.0.1:8788` unless
`VITE_WORKFLOW_API_BASE_URL` is provided. Root route `/` is the actual
workbench; `/design/*` routes are development surfaces and should not own
product runtime state.
