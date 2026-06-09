# Runtime Module Index

## Purpose

`apps/server/src/runtime` owns server-side workflow execution for the current
runtime subset. The public API is still used by the synchronous run route, but
the executor itself runs LangGraph streams so future routes can surface live
progress.

## Structure

- `index.ts` is the public module entrypoint used by `src/app.ts`.
- `executor.ts` builds and streams the LangGraph `StateGraph`, records node
  results, normalizes stream chunks, emits execution/node lifecycle logs, and
  normalizes run-level failures. It owns the node-builder registry, including
  Start, LLM, Knowledge retrieval, and placeholder builders.
- `validation.ts` validates graph shape and reachable node set without
  hard-coding the executable node type list.
- `startValues.ts` materializes Start field values from run input.
- `prompts.ts` resolves namespaced prompt placeholders against runtime state.
- `models.ts` resolves node-level model settings over workflow defaults and
  provider keyring values, then invokes provider-aware LangChain chat models
  from `@langchain/deepseek`, `@langchain/openai`, `@langchain/anthropic`, and
  `@langchain/ollama`. It logs safe provider/model invocation metadata.
- `errors.ts` defines runtime error classes and API error normalization.
- `types.ts` defines runtime execution result, stream event, and executor option
  types.

## Behavior

The runtime accepts a validated workflow payload and run input, compiles the
reachable nodes into LangGraph, stores each node output under its node id in
runtime state, and returns structured node results for API persistence. Start,
LLM, and Knowledge nodes execute real runtime behavior. Knowledge nodes resolve
`queryTemplate`, require readable selected KBs with ready chunks, embed the
query, retrieve top semantic chunks, and emit `result`, `context`, and `query`.
Other known node types currently save placeholder state containing their type,
label, description, and config.

Compiled graphs use a LangGraph checkpointer and execute through `.stream()`
with `updates`, `messages`, and `values`. `executeWorkflowRuntime` collects
normalized stream events and can call `RuntimeExecutorOptions.onStreamEvent` for
each chunk. Tests can inject `fetch`, `checkpointer`, `threadId`, `knowledge`,
and `embeddings` through `RuntimeExecutorOptions` so provider calls, retrieval,
and checkpoint assertions remain deterministic.
