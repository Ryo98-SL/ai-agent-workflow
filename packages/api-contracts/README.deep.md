# API Contracts Deep README

## Architecture

`packages/api-contracts` is a pure TypeScript package. It owns the shared API
surface for server and browser clients, but it does not import Hono, fetch, or
any transport implementation.

- `src/index.ts` exports REST route templates, path builders, request schemas,
  response schemas, run input/output schemas, DTO types, and error helpers.
- `tests/contracts.test.ts` validates representative request and response
  payloads against the public schemas.

## Integration Boundary

Server routes and browser clients should import schemas from this package and
avoid duplicating API payload shapes. Workflow graph data comes from
`@ai-agent-workflow/workflow-domain`.

## Test Strategy

Package tests exercise schema acceptance/rejection, nullable run input,
structured node result metadata, and path generation. Server and client
packages cover route behavior and fetch behavior using these same schemas.
