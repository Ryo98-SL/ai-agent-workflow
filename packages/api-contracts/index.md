# API Contracts Package Index

## Purpose

`packages/api-contracts` owns the shared REST API contract for workflow storage
and workflow run endpoints.

## Structure

- `src/index.ts` contains route templates, path builders, Zod schemas, nullable
  run input, transient run model-provider/keyring settings, structured node
  result contracts, Knowledge Base contracts, inferred DTO/request/response
  types, and normalized API error helpers.
- `tests/contracts.test.ts` covers path generation, nullable run input,
transient model-provider/keyring settings, structured node result metadata,
Knowledge Base payloads, and representative schema parsing.

## Behavior

The package has no runtime transport dependencies. It imports persisted workflow
schemas from `@ai-agent-workflow/workflow-domain` and exposes schemas that the
server and client use to validate every request and response.
