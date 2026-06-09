# Workflow Client Deep README

## Architecture

`packages/workflow-client` is a browser-compatible TypeScript package that wraps
fetch calls to the workflow REST API.

- `src/index.ts` exports `createWorkflowClient`, `WorkflowClientError`, client
  option types, and the typed client interface. Run creation forwards the shared
  request body, including transient model-provider settings. Run deletion maps
  to `DELETE /api/runs/:id` and returns void on `204`. Knowledge Base methods
  cover list/read/create/update/delete plus document list/create/delete/reindex
  and validate every response with shared contracts.
- `tests/client.test.ts` covers mocked fetch success/failure behavior and a
  lightweight integration pass against the Hono server app.

## Integration Boundary

The client imports request/response schemas and path builders from
`@ai-agent-workflow/api-contracts`. It does not contain React hooks, retries,
auth behavior, or UI state.

## Test Strategy

Unit tests use mocked fetch implementations for success, HTTP errors, network
errors, malformed responses, workflow calls, and Knowledge Base calls.
Integration tests route requests into `@ai-agent-workflow/server` through a test
fetch adapter and inject a mocked model response for workflow runs.
