# Workflow Client

Typed fetch client for the workflow REST API.

```ts
import { createWorkflowClient } from "@ai-agent-workflow/workflow-client";

const client = createWorkflowClient({ baseUrl: "http://127.0.0.1:8788" });
const workflows = await client.listWorkflows();
```

Responses are validated with `@ai-agent-workflow/api-contracts`. Network, HTTP,
and schema failures are normalized as `WorkflowClientError`.
