# Web App

Primary browser client for AI Agent Workflow.

```bash
pnpm --filter @ai-agent-workflow/server dev
pnpm --filter @ai-agent-workflow/web dev
```

The web app runs on `http://127.0.0.1:5173` and connects to
`http://127.0.0.1:8788` by default. Set `VITE_WORKFLOW_API_BASE_URL` to point at
another workflow API origin.
