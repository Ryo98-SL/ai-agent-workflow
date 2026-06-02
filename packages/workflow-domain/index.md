# Workflow Domain Package Index

## Purpose

`packages/workflow-domain` owns the persisted workflow model and pure workflow
helpers shared by apps, server code, and future packages.

## Key Files

- `src/schema.ts` exports Zod schemas, TypeScript workflow types, Start field
  contracts, validation helpers, serialization, default workflow creation, and
  collision-free readable node factories.
- `src/promptVariables.ts` extracts and resolves namespaced `{{nodeId.field}}`
  placeholders against workflow runtime state.
- `src/index.ts` is the public package entrypoint.
- `tests/` covers schema parsing, serialization, and prompt variable behavior.

## Behavior

The schema supports the MVP node family: Start, LLM, Knowledge, Tool, Code,
If/Else, Template, and End. Start nodes declare text input fields. LLM nodes
retain legacy `config.variables` compatibility, but runtime prompts resolve
from namespaced workflow state. Loading rejects unsupported versions and
malformed graph data with normalized messages. Serialization updates
`metadata.updatedAt` and omits API keys from saved workflow files.
