# Theme Module

## Purpose

Shared theme state and controls for workbench-ui consumers.

## Structure

- `ThemeProvider.tsx` owns `light` / `dark` / `system` mode state, persists the
  selected mode, resolves system preference, and applies the resolved class to
  the document root.
- `ThemeMenu.tsx` renders the reusable icon trigger and popover menu for theme
  selection. It depends on `ThemeProvider` and the shared workbench button /
  popover components.

## Behavior

Host apps must wrap UI that calls `useTheme` or renders `ThemeMenu` in
`ThemeProvider`. The web homepage and workbench both reuse the same menu so the
stored theme mode follows users across product surfaces.
