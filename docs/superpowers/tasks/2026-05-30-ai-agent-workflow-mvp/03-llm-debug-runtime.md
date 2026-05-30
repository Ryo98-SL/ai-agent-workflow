# 03 LLM Debug Runtime

## Goal

Implement the real single-node LLM debugging path through an OpenAI-compatible runtime adapter.

## Preconditions

- Read `01-project-foundation-and-schema-handoff.md`.
- Read `02-workbench-and-canvas-handoff.md`.
- The LLM node can be selected and configured in the UI.
- The debug panel exists and can display runtime states.

## Scope

- Define runtime adapter interfaces and execution result types.
- Implement `LLMNodeAdapter` for OpenAI-compatible chat completions.
- Add global model settings UI for `baseURL`, `apiKey`, and `model`.
- Resolve prompt variables before execution and expose missing-variable errors.
- Add single-node run action for selected LLM nodes.
- Display resolved prompt, request summary, response text, raw response summary, latency, and normalized errors in `DebugPanel`.
- Add request cancellation or run-lock behavior so duplicate clicks do not create confusing concurrent runs.
- Add a mock OpenAI-compatible server or test fixture for deterministic tests.
- Add unit tests for request construction, response normalization, and error normalization.
- Add component or integration tests for successful and failed LLM node runs against the mock server.

## Non-Goals

- Do not compile the entire graph to LangGraph.
- Do not stream model responses unless it is cheaper than non-streaming.
- Do not add provider-specific presets.
- Do not store API keys in the system keychain yet.

## Outputs

- Runtime adapter interfaces.
- OpenAI-compatible LLM adapter.
- Model settings UI and state handling.
- LLM node run action.
- Debug panel connected to real execution results.
- Mock server or fixtures for tests.
- Runtime and UI tests.

## Handoff Document

Update `03-llm-debug-runtime-handoff.md` when complete.

## Acceptance Document

Reviewer follows `03-llm-debug-runtime-acceptance.md`.

