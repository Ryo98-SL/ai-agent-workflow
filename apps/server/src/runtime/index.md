# Runtime Module Index

## Purpose

`apps/server/src/runtime` owns server-side workflow execution. The public API is
used by the run/create and run/resume routes, and the executor emits normalized
stream events for live UI progress.

## Structure

- `index.ts` is the public module entrypoint used by `src/app.ts`.
- `executor.ts` builds and streams the LangGraph `StateGraph`, records node
  results, normalizes stream chunks, emits execution/node lifecycle logs, and
  normalizes run-level failures. It owns the node-builder registry for Start,
  LLM, Knowledge, Tool, If/Else, Human Input, Template, End, and placeholder
  Code behavior.
- `validation.ts` validates graph shape and reachable node set without
  hard-coding the executable node type list.
- `startValues.ts` materializes Start field values from run input.
- `prompts.ts` resolves namespaced prompt placeholders against runtime state,
  including Chat Mode's ambient `userInput.query` value.
- `models.ts` resolves node-level model settings over workflow defaults and
  provider keyring values, then invokes provider-aware LangChain chat models
  from `@langchain/deepseek`, `@langchain/openai`, `@langchain/anthropic`, and
  `@langchain/ollama`. It logs safe provider/model invocation metadata.
- `tools/` resolves Tool node identities to built-in server runtimes.
- `errors.ts` defines runtime error classes and API error normalization.
- `types.ts` defines runtime execution result, stream event, interrupt,
  conversation-memory, email sender, and executor option types.

## Behavior

The runtime accepts a validated workflow payload and run input, compiles the
reachable nodes into LangGraph, stores each node output under its node id in
runtime state, and returns structured node results for API persistence. Start,
LLM, Knowledge, Tool, If/Else, Human Input, Template, and End nodes execute real
runtime behavior. Knowledge nodes resolve `queryTemplate`, require readable
selected KBs with ready chunks, embed the query, retrieve top semantic chunks,
and emit `result`, `context`, and `query`. Human Input nodes pause execution with
a reviewer form and resume from the selected action/text value. Code nodes save
placeholder state until a runtime implementation exists.

Compiled graphs use a LangGraph checkpointer and execute through `.stream()`
with `updates`, `messages`, and `values`. `executeWorkflowRuntime` collects
normalized stream events and can call `RuntimeExecutorOptions.onStreamEvent` for
each chunk. Tests can inject `fetch`, `checkpointer`, `threadId`, `knowledge`,
`embeddings`, `emailSender`, and resume values through `RuntimeExecutorOptions`
so provider calls, retrieval, tools, interrupts, and checkpoint assertions
remain deterministic.
