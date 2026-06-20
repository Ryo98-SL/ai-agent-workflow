# Web App Deep README

## Architecture

`apps/web` is the primary product client. It is a Vite React app that uses
React Router, renders the product homepage at the root route, preserves the
shared workbench UI at `/workbench`, and injects a typed workflow client.

- `src/main.tsx` creates the browser router, wraps it in the shared
  `I18nProvider`, and renders `RouterProvider`.
- `src/routes.tsx` builds routes from `src/pages/**/*.tsx` via
  `import.meta.glob`, mapping `pages/index.tsx` to `/` and bracketed segments to
  dynamic route params.
- `src/pages/index.tsx` mounts the production homepage with the shared workflow
  client and API base URL.
- `src/pages/workbench/index.tsx` mounts `AppWorkbench` with the shared workflow
  client, enables development model providers in dev mode, reads `workflowId`
  from the URL, writes the active workflow id back to the URL when the
  workbench switches workflows, and points the workbench header brand mark back
  to `/`.
- `src/homepage/` owns the theme-aware Studio/Knowledge homepage shell, the
  workflow card grid, compact local workflow search, Product Locale switcher,
  the search review gallery, and the Studio New Workflow entry point. Its shell,
  cards, search field, header tabs, and primary accents follow the same
  light/dark workbench tokens; the header stays on `bg-card/95` while the
  header-below canvas uses `bg-muted/30` for contrast. Workflow cards render the
  saved workflow metadata icon in a compact responsive grid that reaches four
  columns on desktop, add a hover-only three-dot menu for metadata editing,
  duplicate, and delete actions with a themed confirmation dialog before
  deletion, and the top-left Studio card opens the shared New Workflow template
  dialog. The Knowledge tab uses the same search placement to filter real
  Knowledge Base summaries and render KB cards with a matching hover-only
  three-dot menu for editing summary metadata and deleting editable KBs after a
  themed confirmation dialog. The homepage also mounts the shared local-workflow
  import prompt inside `WorkbenchDataProvider`, matching the workbench sign-in
  migration flow. The header uses a three-column
  grid with a stable right
  utility slot for the Product Locale switcher, shared theme switcher, and
  account menu so the centered tabs do not shift across auth states. A fixed,
  round white GitHub repository shortcut sits at the lower-left corner of the
  homepage. The Product Locale switcher uses the shared workbench `Popover`
  instead of a native select or custom floating implementation.
- `src/i18n/` owns the app-level `web` namespace resources for `en-US` and
  `zh-CN` homepage Product Locale copy.
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

The app depends on `@ai-agent-workflow/workbench-ui` for UI,
`@ai-agent-workflow/workflow-client` for REST communication, and
`@ai-agent-workflow/i18n` for Product Locale provider wiring. It does not import
Electron code or the server implementation directly.

Product Locale resolves locally from manual localStorage preference, browser
language, then `en-US`. It translates app-owned UI chrome and date formatting
without modifying workflow summaries returned by the API.

## Test Strategy

The app has typecheck/build validation. Component behavior is covered in
`@ai-agent-workflow/workbench-ui`, and API behavior is covered in
`@ai-agent-workflow/workflow-client`. Design galleries use static mock data and
are validated by the app build.
