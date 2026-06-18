# Knowledge Components Index

## Purpose

Workbench UI for reusable Knowledge Bases and Knowledge node configuration.

## Structure

- `KnowledgeBasesDialog.tsx` is the settings-launched management dialog. It is a
  fixed-height (`88vh`) two-pane layout: a left list pane (under an "Add knowledge
  base" button) and a right detail pane, each with its own independent scroll
  container so neither overflows the dialog. The left pane lists readable KBs
  (including the seeded read-only Chinese example); the right pane shows the
  selected KB detail (`KnowledgeBaseDetail`), composed from the shared field/
  settings/documents components. The detail view edits metadata with a bottom
  action row (Save + Delete); deleting requires an inline confirmation step.
  Dialog chrome, empty states, list metadata counts, example badges, mutation
  actions, and delete confirmation copy come from the `workbench` Product Locale
  namespace while KB names/descriptions remain user/server data.
- `CreateKnowledgeBaseDialog.tsx` is the two-step creation wizard, opened from the
  dialog's "Add knowledge base" button and exported for product-level entry
  points such as the web homepage. It layers above the parent via an elevated
  overlay/content z-index (`z-[210]`/`z-[211]`). Step 1 collects metadata plus a
  collapsible "Advanced settings" block (chunking/retrieval tuning) and creates the
  KB; step 2 attaches documents to the new KB and only enables "Done" once at least
  one document has been added. Wizard chrome, field labels, placeholders, advanced
  setting labels, document empty states, and action buttons come from the
  `workbench` Product Locale namespace. Closing after step 1 still calls
  `onCreated` so the parent surface can close the dialog and record the created KB.
- `KnowledgeMetadataFields.tsx` — controlled labeled Name/Description inputs shared
  by the wizard (step 1) and the detail pane. Labels and placeholders are localized
  through the `workbench` namespace. Takes an `idPrefix` so the two can coexist in
  the DOM without duplicate label ids.
- `KnowledgeSettingsFields.tsx` — KB settings with `mode: "edit" | "read"`. Edit
  mode exposes chunk size/overlap and top K/score threshold (bounds mirror
  `KnowledgeBaseSettingsSchema`); embedding provider/model are always read-only
  (platform-managed in the MVP). Also exports `EditableKnowledgeSettings` and
  `DEFAULT_EDITABLE_SETTINGS`.
- `KnowledgeDocumentsSection.tsx` — the add-document panel (pasted text plus
  `.txt`/`.md` upload) and the document list with status badges, reindex, and
  inline-confirm delete. Shared by the detail pane and the wizard's step 2, with
  Product Locale applied to section chrome and document actions while document
  titles/status/error messages remain server/user data.
- `shared.tsx` — `Field`, `LoadingRow`, and `errorMessage` helpers.
- `KnowledgeInspector.tsx` is the Knowledge node settings panel. It selects one
  KB while persisting `knowledgeBaseIds`, edits the query template, configures
  semantic retrieval limits, checks prompt variables, and renders output
  variables.

## Boundaries

Components read and mutate data through `src/data/useKnowledgeBases.ts` and the
`WorkbenchWorkflowApi` boundary. They do not import server modules or persist
anonymous KB data locally.
