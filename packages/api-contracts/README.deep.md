# API Contracts Deep README

## Architecture

`packages/api-contracts` is a pure TypeScript package. It owns the shared API
surface for server and browser clients, but it does not import Hono, fetch, or
any transport implementation.

- `src/index.ts` exports REST route templates, path builders, request schemas,
  response schemas, transient run model-provider settings, transient provider
  keyring settings, inline workflow run payloads, Chat Mode query/conversation
  fields, Human Input interrupt/resume schemas, run input/output schemas, SSE
  event schemas, Knowledge Base schemas, account/credit schemas, DTO types, and
  error helpers.
- `tests/contracts.test.ts` validates representative request and response
  payloads against the public schemas.

## Integration Boundary

Server routes and browser clients should import schemas from this package and
avoid duplicating API payload shapes. Workflow graph data comes from
`@ai-agent-workflow/workflow-domain`.

## Test Strategy

Package tests exercise schema acceptance/rejection, nullable run input,
transient run model-provider/keyring settings, inline workflows, structured node
result metadata, Human Input resume payloads, Knowledge Base payloads, account/
credit payloads, SSE events, and path generation. Server and client packages
cover route behavior and fetch behavior using these same schemas.
