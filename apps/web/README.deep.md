# Web App Deep README

## Architecture

`apps/web` is the primary product client. It is a Vite React app that uses
React Router, renders the product homepage at the root route, preserves the
shared workbench UI at `/workbench`, and injects a typed workflow client.

- `src/main.tsx` creates the browser router and renders `RouterProvider`.
- `src/routes.tsx` builds routes from `src/pages/**/*.tsx` via
  `import.meta.glob`, mapping `pages/index.tsx` to `/` and bracketed segments to
  dynamic route params.
- `src/pages/index.tsx` mounts the production homepage with the shared workflow
  client and API base URL.
- `src/pages/workbench/index.tsx` mounts `AppWorkbench` with the shared workflow
  client, enables development model providers in dev mode, reads `workflowId`
  from the URL, and writes the active workflow id back to the URL when the
  workbench switches workflows.
- `src/homepage/` owns the dark Studio/Knowledge homepage shell, the workflow
  card grid, compact local workflow search, the search review gallery, and the
  Studio New Workflow entry point. Its header tabs and primary accents use the
  shared workbench `brand` color tokens, workflow cards render the saved
  workflow metadata icon, and the top-left Studio card opens the shared New
  Workflow template dialog. The header uses a three-column grid with a stable
  account slot so the centered tabs do not shift across auth states.
- `src/pages/design/` hosts design-gallery pages for workbench UI surfaces,
  including the archived homepage candidate at `/design/home-page` and the
  Search/tag variants at `/design/search-tag-filter`.
- `src/design/` contains the gallery implementations used by the design routes.
  `src/design/home-page/` holds the static homepage template variants.
- `src/lib/workflowApi.ts` creates the configured REST client from
  `VITE_WORKFLOW_API_BASE_URL` or the local server default.
- `public/favicon.png` is a cropped screenshot of the homepage header `AIW`
  product mark and is linked from `index.html`.
- `vite.config.ts` owns local dev and production build settings.
- `index.html` is the browser document shell.

## Integration Boundary

The app depends on `@ai-agent-workflow/workbench-ui` for UI and
`@ai-agent-workflow/workflow-client` for REST communication. It does not import
Electron code or the server implementation directly.

## Test Strategy

The app has typecheck/build validation. Component behavior is covered in
`@ai-agent-workflow/workbench-ui`, and API behavior is covered in
`@ai-agent-workflow/workflow-client`. Design galleries use static mock data and
are validated by the app build.
