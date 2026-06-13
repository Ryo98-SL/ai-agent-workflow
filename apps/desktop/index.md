# Desktop Legacy Shell Index

## Purpose

`apps/desktop` keeps Electron available as a legacy wrapper while the browser
web app becomes the primary client.

## Structure

- `src/main.tsx` mounts the shared workbench and workflow client.
- `electron/main.cjs` owns Electron window creation and loads either the Vite
  dev server or the built renderer.
- `vite.config.ts` builds the renderer into `dist/`.

## Behavior

The desktop shell uses server-backed workflow persistence and server workflow
runs. Legacy local file open/save behavior is deferred unless desktop parity
becomes a separate product goal.

Development model providers are enabled in dev mode, matching `apps/web`.
