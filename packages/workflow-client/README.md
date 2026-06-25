# Workflow Client

Typed fetch client for the workflow REST API.

```ts
import { createWorkflowClient } from "@ai-agent-workflow/workflow-client";

const client = createWorkflowClient({ baseUrl: "http://127.0.0.1:8788" });
const workflows = await client.listWorkflows();
```

Responses are validated with `@ai-agent-workflow/api-contracts`. Network, HTTP,
and schema failures are normalized as `WorkflowClientError`. `createRun` accepts
the shared run request shape, including inline workflows, Chat Mode query/
conversation ids, provider-key selection, and transient model provider settings
used only for that execution. The client exposes run streams via `runStreamUrl`
and resume support via `resumeRun`.

The client also exposes typed account, custom model, AI credit, Knowledge Base,
and document methods for listing the anonymous example KB, managing
authenticated private KBs, adding text/file documents, deleting documents, and
queueing reindexing. `getEmailCapability()` reads the public, non-sensitive
real-email availability and quota snapshot.
