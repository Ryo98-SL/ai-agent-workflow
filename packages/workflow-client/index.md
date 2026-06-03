# Workflow Client Package Index

## Purpose

`packages/workflow-client` owns the typed browser/client API for workflow and
run REST endpoints.

## Structure

- `src/index.ts` contains the client factory, methods, response validation, URL
  handling, and normalized error class.
- `tests/client.test.ts` covers mocked fetch paths and Hono app integration.

## Behavior

Consumers configure a base API URL once, then call methods for workflow
list/create/read/update and run create/read/events. Run creation forwards
transient model-provider settings when supplied. Every successful response is
validated with shared API contracts before it reaches the caller.
