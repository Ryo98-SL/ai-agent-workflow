# Workflow Module Index

## Purpose

`src/domain/workflow` owns persisted workflow data shape and prompt variable behavior.

## Key Files

- `schema.ts` exports Zod schemas, TypeScript types, validation helpers, serialization, default workflow creation, and node factories.
- `promptVariables.ts` extracts `{{variable}}` placeholders, resolves values, and reports missing variables.

## Behavior

The schema supports the MVP node family: Start, LLM, Knowledge, Tool, Code, If/Else, Template, and End. Loading rejects unsupported versions and malformed graph data with normalized messages. Serialization omits API keys.
