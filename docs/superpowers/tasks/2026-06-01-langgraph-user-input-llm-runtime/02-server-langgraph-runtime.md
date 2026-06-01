# 02 Server LangGraph Runtime

## Goal

Replace mock run creation in `apps/server` with a real synchronous LangGraph JS execution path for workflows containing one Start node and supported LLM nodes.

## Preconditions

- Read `01-domain-contracts-and-variables-handoff.md`.
- Use shared schemas and helpers from `packages/workflow-domain` and `packages/api-contracts`.
- Preserve the existing REST endpoint shape unless Task 01 explicitly changed a contract.

## Scope

- Add the LangGraph JS dependency to `apps/server`.
- Compile supported workflow nodes and edges into a `StateGraph`.
- Enforce exactly one `start` node and unique node ids before execution.
- Materialize Start field values from request input, defaults, required flags, and optional nulls.
- Resolve LLM prompts from workflow state using namespaced variables.
- Call OpenAI-compatible chat completions using workflow model settings and node overrides.
- Write LLM output to state with `text`, `usage`, and `reasoning`.
- Persist `WorkflowRun` and `RunEvent` records in the existing in-memory maps.
- Return failed runs with normalized errors when validation or execution fails.

## Non-Goals

- Do not implement async queues, streaming, cancellation, or durable storage.
- Do not execute unsupported node types.
- Do not add selected-node testing.
- Do not implement tool, knowledge, code, branching, template, or end semantics.

## Outputs

- Server runtime/compiler module or modules with focused tests.
- Updated route behavior for `POST /api/workflows/:id/runs`.
- Tests for successful Start-to-LLM execution, required missing input, defaults, optional nulls, variable failures, model failures, and event order.

## Handoff Document

Update `02-server-langgraph-runtime-handoff.md` when complete.

## Acceptance Document

Reviewer follows `02-server-langgraph-runtime-acceptance.md`.
