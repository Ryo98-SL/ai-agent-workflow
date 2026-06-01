# Web App Deep README

## Architecture

`apps/web` is the primary product client. It is a Vite React app that mounts the
shared workbench UI and injects a typed workflow client.

- `src/main.tsx` creates the workflow client and renders `AppWorkbench`.
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
