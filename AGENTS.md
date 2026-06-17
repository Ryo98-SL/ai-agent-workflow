# Agent Instructions

## Web Homepage Theme

- Keep the web homepage header tabs and primary homepage accents aligned with
  the workbench brand color tokens (`bg-brand`, `text-brand`,
  `text-brand-foreground`, `border-brand/*`, `ring-brand/*`) instead of
  reintroducing standalone blue/sky tab treatments.
- Workflow cards on the homepage should render the saved workflow metadata icon
  through the shared workbench workflow icon renderer. Do not hard-code a fixed
  workflow card glyph when `workflow.icon` is available.
- Homepage filtering should only use real workflow summary data. Do not add tag
  chips or suggested tags unless workflow tags are persisted by the API.
