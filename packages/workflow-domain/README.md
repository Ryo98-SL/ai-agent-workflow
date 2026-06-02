# Workflow Domain

Shared workflow schema, workflow file helpers, readable node factories, and
namespaced prompt variable utilities for AI Agent Workflow apps and services.

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
