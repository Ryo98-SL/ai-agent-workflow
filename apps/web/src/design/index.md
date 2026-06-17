# Web Design Modules

## Purpose

`src/design` hosts design-only galleries used to compare UI directions before
they are wired into production routes.

## Structure

- `HomePageDesignGallery.tsx` and `home-page/` provide a Dify-style homepage
  candidate for the future root route.
- `WorkflowListDesignGallery.tsx` explores workflow switching patterns.
- `WorkflowMetaDesignGallery.tsx` explores workflow metadata editing surfaces.
- `ModelSettingsDesignGallery.tsx` explores model/provider settings patterns.
- `NewWorkflowDialogDesignGallery.tsx` explores new workflow template pickers.

## Behavior

Design modules are rendered by files under `src/pages/design/`. They use static
mock data and shared UI primitives, and should not become owners of production
state.
