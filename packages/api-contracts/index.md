# API Contracts Package Index

## Purpose

`packages/api-contracts` owns the shared REST API contract for workflow storage
and deterministic mock run endpoints.

## Structure

- `src/index.ts` contains route templates, path builders, Zod schemas, inferred
  DTO/request/response types, and normalized API error helpers.
- `tests/contracts.test.ts` covers path generation and representative schema
  parsing.

## Behavior

The package has no runtime transport dependencies. It imports persisted workflow
schemas from `@ai-agent-workflow/workflow-domain` and exposes schemas that the
server and client use to validate every request and response.
