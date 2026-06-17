# Web App Index

## Purpose

`apps/web` is the primary browser application for the product homepage and
workflow workbench.

## Structure

- `src/main.tsx` creates the React Router instance and renders it.
- `src/routes.tsx` converts `src/pages/**/*.tsx` files into route objects.
- `src/pages/index.tsx` wires `workflow-client` into the production homepage.
- `src/pages/workbench/index.tsx` preserves the full `AppWorkbench` editor at
  `/workbench` and syncs the active `workflowId` search parameter.
- `src/homepage/` contains the dark Studio/Knowledge homepage shell, workflow
  cards, compact workflow search, and Studio New Workflow entry point.
- `src/pages/design/` and `src/design/` contain local design-gallery routes for
  UI review, including archived homepage candidates at `/design/home-page` and
  Search/tag variants at `/design/search-tag-filter`.
- `src/lib/workflowApi.ts` creates the workflow REST client and exports the API
  base URL passed to the workbench auth client.
- `public/` contains static browser assets, including the favicon rendered from
  the homepage `AIW` product mark.
- `vite.config.ts` configures Vite dev and build output.
- `index.html` hosts the React root.

## Behavior

The app connects to the local workflow API at `http://127.0.0.1:8788` unless
`VITE_WORKFLOW_API_BASE_URL` is provided. Root route `/` is the Studio/Knowledge
homepage; `/workbench` is the full workflow editor and honors
`?workflowId=<id>`. `/design/*` routes are development surfaces and should not
own product runtime state. Homepage header tabs and primary accents use the same
green `brand` tokens as the workbench.
