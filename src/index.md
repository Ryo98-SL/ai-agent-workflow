# Source Module Index

## Purpose

`src` contains legacy UI-independent runtime adapter code kept for regression
coverage after the web monorepo migration.

## Structure

- `domain/runtime/` contains the old client-side LLM and Current Time adapter
  implementations.

## Notes

The primary workbench no longer imports this runtime path. Server-backed UI now
lives in `packages/workbench-ui`, `apps/web`, and `apps/desktop`.
