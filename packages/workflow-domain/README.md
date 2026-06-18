# Workflow Domain

Shared workflow schema, workflow file helpers, readable node factories, tool
registry metadata, available-variable helpers, condition evaluation, starter
workflow templates, and namespaced prompt variable utilities for AI Agent
Workflow apps and services. Every persisted workflow node carries a
user-editable `description` alongside its label and type-specific config.

Knowledge nodes have a strong RAG config with `knowledgeBaseIds`,
`queryTemplate`, and semantic retrieval defaults. The package also exposes
output-variable metadata helpers so UI/runtime consumers can describe LLM,
Knowledge, Tool, Agent, and Human Input outputs consistently. Starter templates
include a blank workflow, a ready-to-run Chinese customer-support RAG demo
(Start -> Knowledge -> LLM), a support bot with If/Else plus Human Input review
over the seeded example KB (`EXAMPLE_KNOWLEDGE_BASE_ID`), an Agent tool-routing
demo with a built-in tool plus a Built-in MCP Server tool, and a customer-support
Agent demo that combines Knowledge retrieval with the same built-in/MCP Agent
Tool List.
Template summaries and generated starter copy are localized through explicit
Template Locale APIs: `getWorkflowTemplates(locale)` and
`buildWorkflowFromTemplate(id, locale)`. Created workflows do not store a locale
binding and become ordinary user-authored workflow content after creation.

Model settings are provider-aware. Persisted workflow settings support
`deepseek`, `openai`, `anthropic`, and `ollama`, defaulting new workflows to DeepSeek
`deepseek-v4-flash` at `https://api.deepseek.com`. Workflow settings also keep
provider API keys in a `modelProviderKeys` keyring. Workflow defaults and LLM
node `modelSettings` overrides both support provider, base URL, model,
temperature, and max tokens; node overrides no longer need inline API keys for
new UI flows.

Workflow settings also include `mode` (`workflow` or `chat`), provider-key
preferences for AI credits vs stored API keys, and optional conversation-memory
summary settings. Tool nodes bind to a shared
`provider/providerId/toolName` identity; built-in descriptors currently cover
Current Time and Send Email.

## Commands

```bash
pnpm --filter @ai-agent-workflow/workflow-domain test
pnpm --filter @ai-agent-workflow/workflow-domain typecheck
pnpm --filter @ai-agent-workflow/workflow-domain build
```

## Public API

Import from the package root:

```ts
import {
  buildWorkflowFromTemplate,
  createDefaultWorkflow,
  getWorkflowTemplates,
  parseWorkflowJson,
  resolvePromptWithRuntimeState,
} from "@ai-agent-workflow/workflow-domain";
```
