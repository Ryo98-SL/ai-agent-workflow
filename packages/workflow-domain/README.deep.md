# Workflow Domain Deep README

## Architecture

`packages/workflow-domain` is a pure TypeScript package. It has no React,
Electron, server, or runtime execution dependencies.

- `src/schema.ts` defines the `.agentflow.json` Zod schemas, inferred types,
  node-level descriptions, Start input field contracts, parse/validate/serialize
  helpers, default workflow creation, readable node factories, and
  provider-aware model settings for DeepSeek and Ollama.
- `src/promptVariables.ts` defines namespaced prompt placeholder parsing,
  runtime-state resolution, and legacy variable value merging.
- `src/index.ts` exports the stable public API used by app, runtime, and tests.
- `tests/` contains package-local unit tests for schema and prompt utilities.

## Integration Boundary

Consumers import from `@ai-agent-workflow/workflow-domain`. They should not
reach into package internals, because later API contracts and server code will
share the same entrypoint.

## Test Strategy

Package tests run in a Node Vitest environment. The root app test suite also
imports the package through the workspace dependency to verify integration with
runtime and workbench code.
