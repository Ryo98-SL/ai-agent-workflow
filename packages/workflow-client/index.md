# Workflow Client Package Index

## Purpose

`packages/workflow-client` owns the typed browser/client API for workflow, run,
account, credits, custom model, and Knowledge Base REST endpoints.

## Structure

- `src/index.ts` contains the client factory, methods, response validation, URL
  handling, and normalized error class.
- `tests/client.test.ts` covers mocked fetch paths and Hono app integration.

## Behavior

Consumers configure a base API URL once, then call methods for workflow
list/create/read/update/delete, run create/read/events/stream/resume/delete,
account resources, credits, custom models, and Knowledge Base/document
management. Run creation forwards inline workflows, Chat Mode fields, stored
provider-key selection, and transient model-provider settings when supplied.
Every successful JSON response is validated with shared API contracts before it
reaches the caller.
