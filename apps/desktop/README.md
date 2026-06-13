# Desktop Legacy Shell

Legacy Electron shell for the web-first workbench. It renders the same shared
`AppWorkbench` package as the browser app and talks to the same workflow API.

```bash
pnpm --filter @ai-agent-workflow/server dev
pnpm --filter @ai-agent-workflow/desktop dev
```

The shell runs its renderer on `http://127.0.0.1:5174` in development and uses
the same workflow API default as the web app: `http://127.0.0.1:8788`. Set
`VITE_WORKFLOW_API_BASE_URL` to point it at another API origin.
