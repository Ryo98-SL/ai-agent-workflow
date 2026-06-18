# Web App Index

## Purpose

`apps/web` is the primary browser application for the product homepage and
workflow workbench.

## Structure

- `src/main.tsx` creates the React Router instance, wraps it in
  `I18nProvider`, and renders it.
- `src/routes.tsx` converts `src/pages/**/*.tsx` files into route objects.
- `src/pages/index.tsx` wires `workflow-client` into the production homepage.
- `src/pages/workbench/index.tsx` preserves the full `AppWorkbench` editor at
  `/workbench` and syncs the active `workflowId` search parameter.
- `src/homepage/` contains the theme-aware Studio/Knowledge homepage shell,
  workflow cards, compact workflow search, Product Locale switcher, and Studio
  New Workflow entry point.
- `src/i18n/` contains the app-owned `web` namespace resources for homepage
  Product Locale copy.
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
own product runtime state. Homepage shell surfaces, header tabs, cards, search
controls, and primary accents use the same light/dark workbench tokens as the
editor, including the green `brand` token.

Product Locale resolves from the shared localStorage key, then browser language,
then `en-US`. It is not persisted to the backend or encoded into routes, and it
does not rewrite saved workflow names, descriptions, icons, or other summary
data returned by the API.
