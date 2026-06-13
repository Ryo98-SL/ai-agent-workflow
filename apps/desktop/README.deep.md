# Desktop Legacy Shell Deep README

## Architecture

`apps/desktop` preserves Electron as a legacy wrapper around the web-first
workbench. The renderer imports `@ai-agent-workflow/workbench-ui` and injects
`@ai-agent-workflow/workflow-client`, matching `apps/web`.

- `electron/main.cjs` opens the Electron window and loads Vite dev output or
  the built renderer from `dist/index.html`. The window uses context isolation
  and no Node integration.
- `src/main.tsx` renders the shared workbench with the workflow API client and
  enables development model providers in dev mode.
- `vite.config.ts` builds the renderer bundle; Electron main code is plain CJS
  and is not part of the Vite graph.

## Known Gaps

Desktop file open/save parity and preload IPC are intentionally not part of the
first web CS monorepo migration. Workflow persistence now goes through the
server API, auth/account state goes through the same Better Auth/API boundary as
web, and the browser app is the primary product target.

## Test Strategy

The shell is covered by typecheck/build/lint. UI behavior lives in
`@ai-agent-workflow/workbench-ui`.
