# Homepage Module

## Purpose

Production web homepage for `/`. It owns the dark Studio/Knowledge shell,
workflow card list, compact local workflow search, and the Studio New Workflow
entry point.

## Structure

- `ProductHomepage.tsx` wraps the homepage runtime in `ThemeProvider`,
  `WorkbenchDataProvider`, and the shared toaster.
- `HomepageShell.tsx` renders the product mark, centered `Studio`/`Knowledge`
  tabs, and account slot using a three-column CSS grid. The right account slot
  reserves stable width so auth pending/signed-out/signed-in trigger changes do
  not shift the header. Header tab buttons keep a transparent base border so
  active and inactive states have the same box metrics.
- `StudioPanel.tsx` reads workflows with `useWorkflows`, filters them locally,
  renders workflow cards with saved workflow metadata icons, and opens the
  shared `NewWorkflowDialog` from the create card. Creating a template workflow
  refreshes the workflow list and navigates to `/workbench?workflowId=<id>`.
- `KnowledgePanel.tsx` is the lightweight Knowledge tab surface and reuses the
  same create dialog.
- `SearchTagFilter.tsx` is the reusable controlled single-line workflow search
  input. Escape clears the query.
- `SearchTagFilterGallery.tsx` exposes the compact review surface at
  `/design/search-tag-filter`.
- `types.ts` contains local contracts for homepage tabs, filter value, filter
  variants, and workflow card summaries.

## Behavior

Homepage search matches against workflow summary fields already available from
the current workflow API. It does not show tag chips or suggested tags because
workflow tags are not persisted. Workflow cards link to
`/workbench?workflowId=<id>`, and the workbench route opens that workflow and
keeps the URL synchronized when the header switcher changes workflows.
