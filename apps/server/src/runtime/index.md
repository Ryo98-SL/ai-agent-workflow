# Runtime Module Index

## Purpose

`apps/server/src/runtime` owns synchronous server-side execution for the
supported Start-to-LLM workflow subset.

## Structure

- `index.ts` is the public module entrypoint used by `src/app.ts`.
- `executor.ts` builds and invokes the LangGraph `StateGraph`, records node
  results, emits execution/node lifecycle logs, and normalizes run-level
  failures.
- `validation.ts` validates the executable graph shape and reachable node set.
- `startValues.ts` materializes Start field values from run input.
- `prompts.ts` resolves namespaced prompt placeholders against runtime state.
- `models.ts` invokes provider-aware LangChain chat models for DeepSeek and
  Ollama, using the workflow settings supplied to the current run and logging
  safe provider/model invocation metadata.
- `errors.ts` defines runtime error classes and API error normalization.
- `types.ts` defines runtime execution result and executor option types.

## Behavior

The runtime accepts a validated workflow payload and run input, compiles the
reachable Start/LLM nodes into LangGraph, stores each node output under its node
id in runtime state, and returns structured node results for API persistence.
Tests can inject `fetch` through `RuntimeExecutorOptions` so DeepSeek and
Ollama calls remain deterministic.
