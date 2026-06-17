# Design Page Routes

## Purpose

This folder contains route stubs for design-review pages. Each file exports a
gallery from `src/design` and is registered automatically by `src/routes.tsx`.

## Structure

- `home-page.tsx` exposes the archived homepage template candidate at
  `/design/home-page`.
- `search-tag-filter.tsx` exposes the compact workflow search review surface at
  `/design/search-tag-filter`.
- `workflow-list.tsx` exposes workflow list and switcher candidates.
- `workflow-meta.tsx` exposes workflow metadata editing candidates.
- `model-settings.tsx` exposes model settings candidates.
- `new-workflow.tsx` exposes new workflow dialog candidates.

## Behavior

Design routes are static review surfaces. They stay separate from production
root-route state; when a design is promoted, the production source of truth
lives in the owning app module rather than under `src/design`.
