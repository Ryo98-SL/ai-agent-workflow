# Workflow Domain Deep README

## Architecture

`packages/workflow-domain` is a pure TypeScript package. It has no React,
Electron, server, or runtime execution dependencies.

- `src/schema.ts` defines the `.agentflow.json` Zod schemas, inferred types,
  node-level descriptions, Start input field contracts, parse/validate/serialize
  helpers, DeepSeek-backed default workflow creation, readable node factories, and
  provider-aware model settings for DeepSeek, OpenAI, Anthropic, and Ollama.
  Workflow-level API keys live in `settings.modelProviderKeys`; LLM nodes can
  define `config.modelSettings` overrides and use `resolveLLMModelSettings` to
  merge node settings, workflow defaults, advanced sampling values, and provider
  keyring values.
  Knowledge nodes use a dedicated config schema for user-level RAG resources:
  `knowledgeBaseIds`, `queryTemplate`, and semantic retrieval settings. The file
  also exports output-variable metadata helpers for LLM and Knowledge nodes, the
  well-known example KB id (`EXAMPLE_KNOWLEDGE_BASE_ID`, re-exported by the server
  seed so storage and fixtures never drift), `createKnowledgeDemoWorkflow`,
  the anonymous Chinese customer-support RAG demo wiring Start → Knowledge → LLM,
  `createAgentToolsDemoWorkflow`, the Start → Agent → End tool-routing demo with
  one built-in tool and one Built-in MCP Server tool, and
  `createSupportAgentWorkflow`, the Start → Knowledge → Agent → End support Agent
  demo.
- `src/toolRegistry.ts` defines declarative Tool descriptors, parameter specs,
  output fields, and lookup helpers. Built-in descriptors currently cover
  Current Time and Send Email; Send Email defaults real sending off and exposes
  its optional provider message id. MCP/custom/workflow providers are
  schema-reserved.
- `src/conditions.ts` evaluates If/Else condition rows against runtime state and
  exports shared operator labels.
- `src/availableVariables.ts` computes upstream Available Variables for a
  consumer node, including Chat Mode's ambient `userInput` namespace.
- `src/workflowTemplates.ts` defines stable starter workflow manifests,
  localized `en-US` / `zh-CN` template summaries, and explicit-locale factories
  used by the New Workflow picker. It overlays localized starter copy after
  building the stable base topology, preserving template ids, tools, model
  defaults, and graph wiring.
- `src/promptVariables.ts` defines namespaced prompt placeholder parsing,
  runtime-state resolution, and legacy variable value merging.
- `src/index.ts` exports the stable public API used by app, runtime, and tests.
- `tests/` contains package-local unit tests for schema and prompt utilities.

## Integration Boundary

Consumers import from `@ai-agent-workflow/workflow-domain`. They should not
reach into package internals, because later API contracts and server code will
share the same entrypoint.

Product or Template Locale must be passed explicitly. The domain package does
not read browser state, React context, localStorage, or routes.

## Test Strategy

Package tests run in a Node Vitest environment. They cover schema parsing,
workflow templates, prompt variables, available variables, conditions, and tool
registry behavior. The root app test suite also imports the package through the
workspace dependency to verify integration with legacy runtime code.
