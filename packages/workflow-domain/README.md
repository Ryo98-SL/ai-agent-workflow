# Workflow Domain

Shared workflow schema, workflow file helpers, readable node factories, and
namespaced prompt variable utilities for AI Agent Workflow apps and services.
Every persisted workflow node carries a user-editable `description` alongside
its label and type-specific config.

Model settings are provider-aware. Persisted workflow settings support
`deepseek`, `openai`, `anthropic`, and `ollama`, defaulting to DeepSeek
`deepseek-v4-flash` at `https://api.deepseek.com`. Workflow settings also keep
provider API keys in a `modelProviderKeys` keyring. Workflow defaults and LLM
node `modelSettings` overrides both support provider, base URL, model,
temperature, and max tokens; node overrides no longer need inline API keys for
new UI flows.

## Commands

```bash
pnpm --filter @ai-agent-workflow/workflow-domain test
pnpm --filter @ai-agent-workflow/workflow-domain typecheck
pnpm --filter @ai-agent-workflow/workflow-domain build
```

## Public API

Import from the package root:

```ts
import { createDefaultWorkflow, parseWorkflowJson, resolvePromptWithRuntimeState } from "@ai-agent-workflow/workflow-domain";
```
