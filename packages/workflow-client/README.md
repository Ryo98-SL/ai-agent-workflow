# Workflow Client

Typed fetch client for the workflow REST API.

```ts
import { createWorkflowClient } from "@ai-agent-workflow/workflow-client";

const client = createWorkflowClient({ baseUrl: "http://127.0.0.1:8788" });
const workflows = await client.listWorkflows();
```

Responses are validated with `@ai-agent-workflow/api-contracts`. Network, HTTP,
and schema failures are normalized as `WorkflowClientError`. `createRun` accepts
the shared run request shape, including transient model provider settings used
only for that execution. The client also exposes typed Knowledge Base and
document methods for listing the anonymous example KB, managing authenticated
private KBs, adding text/file documents, deleting documents, and queueing
reindexing.
