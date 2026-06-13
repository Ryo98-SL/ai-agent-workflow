# Workflow Domain Deep README

## Architecture

`packages/workflow-domain` is a pure TypeScript package. It has no React,
Electron, server, or runtime execution dependencies.

- `src/schema.ts` defines the `.agentflow.json` Zod schemas, inferred types,
  node-level descriptions, Start input field contracts, parse/validate/serialize
  helpers, default workflow creation, readable node factories, and
  provider-aware model settings for DeepSeek, OpenAI, Anthropic, and Ollama.
  Workflow-level API keys live in `settings.modelProviderKeys`; LLM nodes can
  define `config.modelSettings` overrides and use `resolveLLMModelSettings` to
  merge node settings, workflow defaults, advanced sampling values, and provider
  keyring values.
  Knowledge nodes use a dedicated config schema for user-level RAG resources:
  `knowledgeBaseIds`, `queryTemplate`, and semantic retrieval settings. The file
  also exports output-variable metadata helpers for LLM and Knowledge nodes, the
  well-known example KB id (`EXAMPLE_KNOWLEDGE_BASE_ID`, re-exported by the server
  seed so storage and fixtures never drift), and `createKnowledgeDemoWorkflow`,
  the anonymous Chinese customer-support RAG demo wiring Start → Knowledge → LLM.
- `src/toolRegistry.ts` defines declarative Tool descriptors, parameter specs,
  output fields, and lookup helpers. Built-in descriptors currently cover
  Current Time and Send Email; MCP/custom/workflow providers are schema-reserved.
- `src/conditions.ts` evaluates If/Else condition rows against runtime state and
  exports shared operator labels.
- `src/availableVariables.ts` computes upstream Available Variables for a
  consumer node, including Chat Mode's ambient `userInput` namespace.
- `src/workflowTemplates.ts` defines the starter workflow registry used by the
  New Workflow picker.
- `src/promptVariables.ts` defines namespaced prompt placeholder parsing,
  runtime-state resolution, and legacy variable value merging.
- `src/index.ts` exports the stable public API used by app, runtime, and tests.
- `tests/` contains package-local unit tests for schema and prompt utilities.

## Integration Boundary

Consumers import from `@ai-agent-workflow/workflow-domain`. They should not
reach into package internals, because later API contracts and server code will
share the same entrypoint.

## Test Strategy

Package tests run in a Node Vitest environment. They cover schema parsing,
workflow templates, prompt variables, available variables, conditions, and tool
registry behavior. The root app test suite also imports the package through the
workspace dependency to verify integration with legacy runtime code.
