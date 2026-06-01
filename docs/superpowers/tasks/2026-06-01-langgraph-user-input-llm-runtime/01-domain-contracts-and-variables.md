# 01 Domain Contracts And Variables

## Goal

Update shared workflow and API contracts so Start-declared inputs, namespaced prompt variables, and structured node results are represented consistently across server, client, and tests.

## Preconditions

- Read `docs/superpowers/specs/2026-06-01-langgraph-user-input-llm-design.md`.
- Read existing workflow schema and variable helpers in `packages/workflow-domain/src`.
- Read API contracts in `packages/api-contracts/src/index.ts`.

## Scope

- Add `start.config.fields` with field name, label, required, and default value support.
- Preserve compatibility for existing workflows where `start.config` is empty.
- Deprecate LLM variable values as a runtime source without breaking old files that still contain `llm.config.variables`.
- Add or update helpers for parsing and resolving namespaced references like `{{start1.topic}}`.
- Update node creation so new nodes get readable collision-free ids such as `start1` and `llm1`.
- Update API contracts so run input and node result data can represent nulls and structured metadata.

## Non-Goals

- Do not implement LangGraph execution.
- Do not change workbench UI components beyond whatever is needed for type compatibility.
- Do not migrate existing persisted node ids.
- Do not add user-editable node ids.

## Outputs

- Updated workflow-domain schemas, types, defaults, and helpers.
- Updated API contract schemas and exported types.
- Unit tests for Start fields, readable id creation, namespaced variable parsing, null handling, and response contract shape.

## Handoff Document

Update `01-domain-contracts-and-variables-handoff.md` when complete.

## Acceptance Document

Reviewer follows `01-domain-contracts-and-variables-acceptance.md`.
