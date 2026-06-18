# Workflow Domain Package Index

## Purpose

`packages/workflow-domain` owns the persisted workflow model and pure workflow
helpers shared by apps, server code, and future packages.

## Key Files

- `src/schema.ts` exports Zod schemas, TypeScript workflow types, Start field
  contracts, node descriptions, chat/memory settings, provider-key preferences,
  validation helpers, serialization, workflow factories, the well-known example
  KB id (`EXAMPLE_KNOWLEDGE_BASE_ID`), collision-free readable node factories,
  and node output variable metadata.
- `src/toolRegistry.ts` exports Tool Registry descriptors, parameter specs,
  output metadata, and identity lookup helpers for built-in tools. It also owns
  the pure param-spec↔JSON-Schema converters (`paramSpecToJsonSchema`,
  `jsonSchemaToParamSpec`) and the **client-only** MCP descriptor merge
  (`registerMcpToolDescriptors` / `getToolDescriptors`) that keeps
  `resolveToolDescriptor` synchronous (ADR 0004 §6 — never inject on the server).
- `src/conditions.ts` evaluates If/Else branches against runtime state.
- `src/availableVariables.ts` computes upstream variable groups for prompt,
  condition, tool, and template authoring.
- `src/workflowTemplates.ts` exports stable starter workflow manifests,
  `getWorkflowTemplates(locale)`, `getWorkflowTemplate(id, locale)`, and
  `buildWorkflowFromTemplate(id, locale)` for the New Workflow picker. It
  localizes template summaries and generated starter copy without storing a
  locale on created workflows.
- `src/promptVariables.ts` extracts and resolves namespaced `{{nodeId.field}}`
  placeholders against workflow runtime state.
- `src/index.ts` is the public package entrypoint.
- `tests/` covers schema parsing, serialization, prompt variables, available
  variables, conditions, tool registry behavior, and workflow templates.

## Behavior

The schema supports Start, LLM, Knowledge, Tool, Agent, Code, If/Else, Human
Input, Template, and End nodes. Start nodes declare text input fields. LLM nodes
use message-based prompts and optional conversation memory. Knowledge nodes
reference user-level KBs with `knowledgeBaseIds`, resolve a `queryTemplate`, and
carry semantic retrieval defaults. Tool nodes bind to a
`provider/providerId/toolName` identity plus generic JSON params. Agent nodes
(ADR 0005) run a bounded function-calling loop over an inline tool list
(`tools`: the same identity triple a Tool node binds to) with `instruction`,
variable-bearing `query` (defaults to `{{userInput.query}}`), `maxIterations`,
and `memory`; `react` strategy is reserved. Human Input nodes define reviewer
prompts, actions, and optional text input. Template nodes shape runtime
variables into final text.

Model settings accept DeepSeek, OpenAI, Anthropic, and Ollama providers.
Workflow API keys live in `settings.modelProviderKeys`; active stored-key or AI
credit preference lives in `settings.providerKeyPrefs`. Loading rejects
unsupported versions and malformed graph data with normalized messages.
Serialization updates `metadata.updatedAt` and migrates legacy workflow provider
keys into the provider keyring.

Starter workflow factories create runnable examples for the New Workflow picker:
blank, customer-support RAG, customer-support HITL, Agent tool routing, and a
customer-support Agent that combines Knowledge retrieval with a built-in tool and
a Built-in MCP Server tool. Template Locale is an explicit input to the template
registry; Product Locale changes after creation do not rewrite saved workflow
content.
