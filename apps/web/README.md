# Web App

Primary browser client for AI Agent Workflow. It mounts the shared workbench UI
at `/` and exposes design-gallery routes under `/design/*`.

```bash
pnpm --filter @ai-agent-workflow/server dev
pnpm --filter @ai-agent-workflow/web dev
```

The web app runs on `http://127.0.0.1:5173` and connects to
`http://127.0.0.1:8788` by default. Set `VITE_WORKFLOW_API_BASE_URL` to point at
another workflow API origin.

Routes are generated from `src/pages/**/*.tsx`, so adding a page file is enough
to register a route. The production workbench route lives in
`src/pages/index.tsx`; design-only galleries live in `src/pages/design/`.
