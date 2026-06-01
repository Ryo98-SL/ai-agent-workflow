# TypeScript Config Package Index

## Purpose

`packages/tsconfig` owns shared TypeScript compiler presets for the workspace.

## Key Files

- `base.json` defines strict shared compiler defaults.
- `react.json` enables React JSX support for app and UI packages.
- `library.json` sets declaration-oriented defaults for library packages.

## Behavior

The package has no runtime code. Consumers extend the JSON presets from their
own `tsconfig.json` files.
