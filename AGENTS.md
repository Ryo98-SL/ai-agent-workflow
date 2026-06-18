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

## Gotchas

- Before building complex UI components, check the existing shared components
  and package exports first. Prefer reusing codebase primitives such as the
  shared workbench `Popover` instead of duplicating behavior or styling.
- The web homepage header must use a three-column CSS grid
  (`1fr auto 1fr`) so the center tabs are centered against the full viewport,
  not against the uneven left and right content widths.
- Reserve stable width for the homepage header account slot. Auth/session UI can
  render different trigger widths while pending, signed out, and signed in; that
  width change must not cause header layout shift.
- Homepage header tab buttons must keep identical box metrics in active and
  inactive states. Use transparent borders in the base state and only change
  color/background/shadow for active styling.
