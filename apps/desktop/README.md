# Desktop Legacy Shell

Legacy Electron shell for the web-first workbench.

```bash
pnpm --filter @ai-agent-workflow/server dev
pnpm --filter @ai-agent-workflow/desktop dev
```

The shell runs its renderer on `http://127.0.0.1:5174` in development and uses
the same workflow API default as the web app: `http://127.0.0.1:8788`.
