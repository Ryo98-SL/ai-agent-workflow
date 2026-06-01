# TypeScript Config Deep README

## Architecture

`packages/tsconfig` publishes shared JSON-only TypeScript presets.

- `base.json` contains strict shared compiler defaults.
- `react.json` extends the base preset and enables `react-jsx`.
- `library.json` extends the base preset and enables declaration output
  settings for package builds.

## Integration Boundary

Apps and packages should extend these presets instead of duplicating compiler
options. Package-specific `include`, `types`, and emit settings remain local to
the consuming package.
