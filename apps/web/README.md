# Web App

Primary browser client for AI Agent Workflow. It renders the product homepage at
`/`, preserves the shared workflow editor at `/workbench`, and exposes
design-gallery routes under `/design/*`.

```bash
pnpm --filter @ai-agent-workflow/server dev
pnpm --filter @ai-agent-workflow/web dev
```

The web app runs on `http://127.0.0.1:5173` and connects to
`http://127.0.0.1:8788` by default. Set `VITE_WORKFLOW_API_BASE_URL` to point at
another workflow API origin.

Routes are generated from `src/pages/**/*.tsx`, so adding a page file is enough
to register a route. The production homepage lives in `src/pages/index.tsx`,
the preserved workbench route lives in `src/pages/workbench/index.tsx`, and
design-only galleries live in `src/pages/design/`.

The homepage follows the shared workbench light/dark theme tokens for its shell,
header-below canvas, cards, search field, header tabs, and primary accents. Its
header places the Product Locale switcher beside the shared theme switcher and
account menu; the language menu uses the shared workbench `Popover`.
Studio workflow cards read each workflow's saved metadata icon, format edited
dates with Product Locale, use a compact responsive grid that reaches four
columns on desktop, the top-left card opens the shared New Workflow template
dialog, and the compact search field filters only real workflow summary fields.
Product Locale is local to the browser; it translates app-owned homepage chrome
without rewriting workflow summaries returned by the API. The browser favicon is
served from `public/favicon.png` and matches the homepage header `AIW` mark.
