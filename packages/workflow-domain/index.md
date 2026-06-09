# Workflow Domain Package Index

## Purpose

`packages/workflow-domain` owns the persisted workflow model and pure workflow
helpers shared by apps, server code, and future packages.

## Key Files

- `src/schema.ts` exports Zod schemas, TypeScript workflow types, Start field
  contracts, node descriptions, validation helpers, serialization, default
  workflow creation, the Chinese customer-support RAG demo factory
  (`createKnowledgeDemoWorkflow`) plus the well-known example KB id
  (`EXAMPLE_KNOWLEDGE_BASE_ID`), collision-free readable node factories, and node
  output variable metadata.
- `src/promptVariables.ts` extracts and resolves namespaced `{{nodeId.field}}`
  placeholders against workflow runtime state.
- `src/index.ts` is the public package entrypoint.
- `tests/` covers schema parsing, serialization, and prompt variable behavior.

## Behavior

The schema supports the MVP node family: Start, LLM, Knowledge, Tool, Code,
If/Else, Template, and End. Every node carries a user-editable description.
Start nodes declare text input fields. Knowledge nodes reference user-level KBs
with `knowledgeBaseIds`, resolve a `queryTemplate`, and carry semantic retrieval
defaults for future runtime execution. `createKnowledgeDemoWorkflow` builds a
Start → Knowledge → LLM customer-support demo that queries the seeded example KB
with `{{start1.customerQuestion}}` and grounds the answer on
`{{knowledge1.context}}`. LLM nodes retain legacy
`config.variables` compatibility, but runtime prompts resolve from namespaced
workflow state. Model settings accept DeepSeek, OpenAI, Anthropic, and Ollama
providers. Workflow API keys live in `settings.modelProviderKeys`. Workflow
defaults and LLM node overrides share provider/model/endpoint plus temperature
and max-token settings. Loading rejects unsupported versions and malformed graph
data with normalized messages. Serialization updates `metadata.updatedAt` and
migrates legacy workflow provider keys into the provider keyring.
