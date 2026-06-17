# Home Page Design Module

## Purpose

This module contains the archived design-only homepage candidate that preceded
the production root route. The candidate is a static Dify-style Studio dashboard
and does not own product runtime state.

## Structure

- `HomePageDesignGallery.tsx` mounts the current homepage review surface.
- `DifyStyleStudioHome.tsx` renders the full-page dark Studio dashboard.
- `StudioTopNav.tsx` renders the app header with workspace controls and the
  `Studio` / `Knowledge` tabs.
- `StudioFilterBar.tsx` renders app-type filters, ownership filter, tag filter,
  and search.
- `StudioCreateCard.tsx` renders the create/import action panel.
- `StudioAppCard.tsx` renders reusable app cards.
- `studioData.ts` contains static review data and icon metadata.

## Behavior

The module is static and is mounted through `src/pages/design/home-page.tsx`.
It is retained as visual history only. The production homepage source of truth
lives in `src/homepage/`, removes the old second-row filters/import affordance,
uses real workflow summaries, and opens the shared Knowledge Base create dialog.
