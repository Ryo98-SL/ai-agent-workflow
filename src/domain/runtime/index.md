# Runtime Module Index

## Purpose

`src/domain/runtime` owns executable node adapter contracts and concrete MVP runtime behavior.

## Key Files

- `types.ts` defines adapter interfaces, runtime context, request summaries, errors, and normalized results.
- `llmAdapter.ts` executes LLM nodes against OpenAI-compatible chat completions endpoints.
- `toolAdapter.ts` executes the built-in Current Time Tool.
- `runtimeService.ts` dispatches selected nodes to supported adapters and normalizes unsupported-node responses.

## Behavior

LLM execution resolves prompt variables before making requests, surfaces missing-variable errors without network calls, supports run cancellation, and records latency, request details, response text, raw summaries, and normalized errors.
