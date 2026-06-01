# Runtime Module Index

## Purpose

`src/domain/runtime` owns legacy executable node adapter contracts and concrete
runtime behavior retained for regression coverage.

## Key Files

- `types.ts` defines adapter interfaces, runtime context, request summaries, errors, and normalized results.
- `llmAdapter.ts` executes LLM nodes against OpenAI-compatible chat completions endpoints.
- `toolAdapter.ts` executes the built-in Current Time Tool.
- `runtimeService.ts` dispatches selected nodes to supported adapters and normalizes unsupported-node responses.

## Behavior

LLM execution resolves prompt variables before making requests, surfaces
missing-variable errors without network calls, supports run cancellation, and
records latency, request details, response text, raw summaries, and normalized
errors. The migrated workbench no longer calls this path; server execution work
is deferred in `docs/todo.md`.
