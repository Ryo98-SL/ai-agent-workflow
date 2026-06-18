# Homepage Module

## Purpose

Production web homepage for `/`. It owns the theme-aware Studio/Knowledge shell,
workflow card list, compact local workflow search, and the Studio New Workflow
entry point.

## Structure

- `ProductHomepage.tsx` wraps the homepage runtime in `ThemeProvider`,
  `WorkbenchDataProvider`, and the shared toaster.
- `HomepageShell.tsx` renders the product mark, centered `Studio`/`Knowledge`
  tabs, and right utility slot using a three-column CSS grid. Its header uses
  `bg-card/95`, while the header-below canvas uses `bg-muted/30` so homepage
  cards sit on a subtly grayer workbench-token background.
  Text, borders, tabs, and accents use the same `text-foreground`,
  `text-muted-foreground`, `border-border`, and `brand` tokens as the workbench.
  The right slot reserves stable width for the theme switcher plus auth
  pending/signed-out/signed-in states so trigger changes do not shift the
  header. Header tab buttons keep a transparent base border so active and
  inactive states have the same box metrics.
- `ProductHomepage.tsx` provides the shared `ThemeProvider` and places the
  Product Locale `LanguageSwitcher`, workbench `ThemeMenu`, and `AuthMenu` in
  the homepage header.
- `LanguageSwitcher.tsx` reads `useProductLocale` from the shared i18n package,
  opens the locale list through the shared workbench `Popover`, and persists
  manual language selection through the shared localStorage key.
- `StudioPanel.tsx` reads workflows with `useWorkflows`, filters them locally,
  renders compact theme-aware workflow cards with saved workflow metadata icons,
  and opens the shared `NewWorkflowDialog` from the create card. The responsive
  grid uses 2 columns from `md`, 3 from `lg`, and 4 from `xl`. Creating a
  template workflow refreshes the workflow list and navigates to
  `/workbench?workflowId=<id>`.
- `WorkflowCardActions.tsx` owns the workflow-card three-dot action menu. The
  trigger appears on hover/focus and stays visible while the menu or confirm
  dialog is open. Editing uses the shared workbench `WorkflowMetaEditor`;
  duplicate reads the full workflow before creating a localized copy; delete
  opens a themed confirm dialog before calling the delete mutation.
- `KnowledgeBaseCardActions.tsx` owns the Knowledge Base card three-dot action
  menu. It mirrors the workflow card trigger placement, edits KB name/
  description through the shared Knowledge Base mutation hook, and confirms
  deletion before calling the delete mutation. Read-only example KBs keep edit
  and delete actions disabled.
- `KnowledgePanel.tsx` is the Knowledge tab surface. It reuses the Studio header
  search placement, filters real Knowledge Base summaries from the active
  workbench API, renders compact theme-aware KB cards with action menus, and
  opens the Knowledge Base create dialog.
- `SearchTagFilter.tsx` is the reusable controlled single-line workflow search
  input. It follows the workbench field token pattern and Escape clears the
  query.
- `../i18n/` owns the homepage `web` namespace resources for `en-US` and
  `zh-CN`.
- `SearchTagFilterGallery.tsx` exposes the compact review surface at
  `/design/search-tag-filter`.
- `types.ts` contains local contracts for homepage tabs, filter value, filter
  variants, and workflow card summaries.

## Behavior

Homepage search matches against workflow and Knowledge Base summary fields
already available from the current workflow API. It does not show tag chips or
suggested tags because workflow tags are not persisted. Workflow cards link to
`/workbench?workflowId=<id>` while their card action trigger owns edit,
duplicate, and delete actions without navigating. Delete is intercepted by an
explicit confirm dialog. Knowledge Base cards keep their edit/delete actions in
the same lower-right menu pattern and disable those actions for read-only example
KBs. The workbench route opens linked workflows and keeps the URL synchronized
when the header switcher changes workflows.
Product Locale translates homepage chrome and date formatting only; workflow
names, descriptions, icons, and other saved summary fields are rendered as
stored.
