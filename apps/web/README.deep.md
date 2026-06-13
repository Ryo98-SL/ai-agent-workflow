# Web App Deep README

## Architecture

`apps/web` is the primary product client. It is a Vite React app that uses
React Router, mounts the shared workbench UI at the root route, and injects a
typed workflow client.

- `src/main.tsx` creates the browser router and renders `RouterProvider`.
- `src/routes.tsx` builds routes from `src/pages/**/*.tsx` via
  `import.meta.glob`, mapping `pages/index.tsx` to `/` and bracketed segments to
  dynamic route params.
- `src/pages/index.tsx` mounts `AppWorkbench` with the shared workflow client
  and enables development model providers in dev mode.
- `src/pages/design/` hosts design-gallery pages for workbench UI surfaces.
- `src/design/` contains the gallery implementations used by the design routes.
- `src/lib/workflowApi.ts` creates the configured REST client from
  `VITE_WORKFLOW_API_BASE_URL` or the local server default.
- `vite.config.ts` owns local dev and production build settings.
- `index.html` is the browser document shell.

## Integration Boundary

The app depends on `@ai-agent-workflow/workbench-ui` for UI and
`@ai-agent-workflow/workflow-client` for REST communication. It does not import
Electron code or the server implementation directly.

## Test Strategy

The app has typecheck/build validation. Component behavior is covered in
`@ai-agent-workflow/workbench-ui`, and API behavior is covered in
`@ai-agent-workflow/workflow-client`.
