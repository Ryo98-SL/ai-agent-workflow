# LangGraph User Input And LLM Design

Date: 2026-06-01

## Summary

Replace the server's mock run behavior with a first real LangGraph JS execution path for workflows that contain one `Start` node and one or more `LLM` nodes.

The canvas keeps the existing visual language: `Start` remains the workflow entry node so it lines up with LangGraph terminology. Its product role changes from an empty marker to a run-time input declaration node, similar to Dify's User Input concept. `LLM` nodes no longer own static variable values. They consume namespaced variables from workflow state and write their own namespaced output values back into state.

## Goals

- Let users configure workflow input fields on the `Start` node.
- Enforce exactly one `Start` node per workflow.
- Use existing immutable `node.id` values as variable namespaces.
- Let LLM prompts reference variables with `{{nodeId.field}}`, such as `{{start1.topic}}` or `{{llm1.text}}`.
- Run the complete workflow through the server, not a selected node test path.
- Compile the supported workflow subset into a real LangGraph JS app in `apps/server`.
- Return run output and events through the existing REST API shape.
- Keep the first production path narrow: text-only `Start` inputs and OpenAI-compatible chat completions for `LLM`.

## Non-Goals

- File, image, audio, or other multimodal input fields.
- Mid-run human input, pause, resume, or interrupt semantics.
- Single-node testing.
- Branching, loops, retries, parallel execution tuning, streaming, durable queues, or hosted run persistence.
- Full support for Knowledge, Tool, Code, If/Else, Template, and End nodes.
- Automatic prompt rewriting when a workflow from an old schema has non-ideal node ids.
- User-editable node ids.

## Accepted Product Decisions

- `Start` stays named and typed as `start`; it is not renamed to `userInput`.
- A workflow must contain exactly one `start` node.
- `node.id` is the variable namespace and must not be edited after creation.
- The inspector shows `node.id` as read-only so users can copy it into prompt variables.
- New nodes should use readable deterministic ids such as `start1`, `llm1`, and `llm2` instead of random suffixes.
- Existing workflow node ids are not migrated because edges and existing references depend on them.
- The Run action executes the whole workflow.
- `LLM` prompt variables are auto-detected from prompts and resolved from workflow state.
- `LLM` nodes do not store per-variable input values.
- `LLM` output fields are fixed: `text`, `usage`, and `reasoning`.

## Workflow Schema

`start.config` gains text input field declarations:

```ts
type StartField = {
  name: string;
  label?: string;
  required: boolean;
  defaultValue?: string;
};

type StartConfig = {
  fields: StartField[];
};
```

Field rules:

- `name` is required, unique within the `Start` node, and matches `[a-zA-Z_][a-zA-Z0-9_]*`.
- `name` cannot contain `.` because dot separates namespace and field.
- `label` is optional display text.
- `required` defaults to `false`.
- `defaultValue` is optional text.

`llm.config.variables` is deprecated as a value source. The schema can continue to accept it during migration to avoid breaking existing files, but new UI should not write or depend on it. Prompt variables are parsed from `systemPrompt` and `userPrompt`.

## Variable Model

Variables use node-scoped references:

```text
{{start1.topic}}
{{llm1.text}}
{{llm1.usage}}
{{llm1.reasoning}}
```

Resolution rules:

- A variable reference must include a node id and a field path.
- The first path segment is always the producing node id.
- The remaining path is read from that node's state object.
- Missing references fail the run with a clear validation error.
- `null` references render as an empty string in prompts.
- Non-string values such as `usage` are stringified when rendered into prompts.

The initial runtime state shape is:

```ts
type WorkflowRuntimeState = Record<string, Record<string, unknown>>;
```

Example state after `Start` and one `LLM`:

```json
{
  "start1": {
    "topic": "LangGraph",
    "audience": null
  },
  "llm1": {
    "text": "LangGraph is a graph runtime for LLM applications.",
    "usage": {
      "total_tokens": 42
    },
    "reasoning": null
  }
}
```

## Start Input Semantics

At run creation time, the server validates request input against the single `Start` node's fields:

- If a value is provided in `CreateRunRequest.input`, use it.
- Else if `defaultValue` is set, use the default value.
- Else if `required` is `true`, fail the run before model calls.
- Else write `null`.

The frontend should mirror these rules for a better user experience, but server validation is authoritative.

## LLM Semantics

An `LLM` node:

- Reads prompt text from `systemPrompt` and `userPrompt`.
- Parses references like `{{start1.topic}}`.
- Resolves them from the current LangGraph state.
- Calls the configured OpenAI-compatible chat completions endpoint.
- Writes output to `state[llmNode.id]`.

Output shape:

```ts
type LLMNodeOutput = {
  text: string;
  usage: unknown | null;
  reasoning: unknown | null;
};
```

`text` comes from the assistant message content. `usage` is copied from the model response when present. `reasoning` is copied only when the response includes a recognizable reasoning field; otherwise it is `null`.

## Frontend Design

### Node Creation

Node creation should assign readable ids by type:

- `start1`
- `llm1`, `llm2`, ...
- `tool1`, `code1`, etc. for future consistency

The id generator must avoid collisions with existing nodes. If `llm1` exists, the next LLM becomes `llm2`.

The palette should prevent adding a second `Start` node. It may hide the item or render it disabled with a short title.

### Start Inspector

The Start inspector supports:

- Read-only node id.
- Node label editing.
- Field list editing.
- Add field.
- Remove field.
- Field name input.
- Optional label input.
- Required checkbox.
- Default value input.

The inspector should validate obvious local issues: duplicate names, invalid names, and empty names. It should not need to know all runtime validation details.

### LLM Inspector

The LLM inspector supports:

- Read-only node id.
- Node label editing.
- Model override.
- System prompt.
- User prompt.
- Temperature.
- Max tokens.
- Auto-detected prompt variable references.
- A simple status per variable: resolvable producer exists, missing producer, or unsupported reference.

It should not render editable variable value inputs.

### Run Controls

The floating Run button and Debug panel become workflow-level:

- Button label: `Run workflow`.
- Enabled when a workflow exists and no run is in progress.
- Opens a run panel with inputs generated from the `Start` field declarations.
- Required fields should be visibly required.
- Optional fields without defaults may be left empty and sent as omitted or empty; the server normalizes them to `null`.

The Run Log keeps the existing result shape but should describe the whole workflow rather than a selected node.

## Server LangGraph Design

`apps/server` adds `@langchain/langgraph` and compiles the supported workflow subset into a `StateGraph`.

Compile flow:

1. Validate exactly one `start` node.
2. Validate all node ids are unique.
3. Validate at least one outgoing edge path exists from `start` when executable nodes exist.
4. Validate supported runtime node types for this milestone: `start` and `llm`.
5. Convert workflow edges to LangGraph edges.
6. Connect LangGraph `START` to the workflow's `start` node.
7. Add one graph node per supported workflow node.
8. Compile and invoke with an initial state that includes request input.

Execution behavior:

- The `start` LangGraph node materializes `state[start.id]`.
- Each `llm` LangGraph node resolves prompts, calls the OpenAI-compatible endpoint, and returns a partial state update under its own id.
- The final run output includes the final state and per-node results.

The first implementation can execute synchronously inside the HTTP request, matching the current API behavior. Later durable execution can keep the same API contracts while moving execution to a queue.

## API Contracts

The current run endpoint remains:

```text
POST /api/workflows/:id/runs
```

`CreateRunRequest.input` should widen from `Record<string, string>` to a shape that can represent nulls:

```ts
type RunInput = Record<string, string | null>;
```

If preserving compatibility is easier, the client can still submit strings only and the server can normalize omitted optional fields to `null`. The response should allow non-string node output metadata:

```ts
type WorkflowNodeResult = {
  nodeId: string;
  label: string;
  status: "queued" | "running" | "succeeded" | "failed";
  output: string;
  data?: Record<string, unknown>;
};
```

`output` stays a display string for current UI compatibility. `data` carries structured output such as LLM usage and reasoning.

## Errors

The server should return normalized API errors for:

- Missing workflow.
- Invalid request body.
- Workflow has zero or multiple `start` nodes.
- Duplicate node ids.
- Unsupported node type in executable path.
- Missing required Start field.
- Invalid variable reference syntax.
- Referenced node id does not exist.
- Referenced field does not exist.
- Missing model provider settings.
- Model endpoint HTTP or network failures.

Run failures caused by workflow execution should create a failed `WorkflowRun` with `error` populated and events up to the failure point.

## Testing Strategy

Add or update tests in these areas:

- `packages/workflow-domain`
  - `start.config.fields` schema validation.
  - readable id creation.
  - namespaced prompt variable parsing and resolution.
  - legacy `llm.config.variables` compatibility where retained.
- `apps/server`
  - successful LangGraph run with `Start -> LLM`.
  - required Start field missing fails.
  - Start default value is used.
  - optional Start field without default becomes `null`.
  - LLM prompt resolves `{{start1.topic}}`.
  - LLM output includes `text`, and includes `usage` or `reasoning` when returned by the model.
  - unsupported executable node returns a clear failure.
  - run events preserve created, started, node completed or failed, and completed or failed order.
- `packages/workbench-ui`
  - Start inspector field editing.
  - LLM inspector variable detection display.
  - Run workflow panel renders Start fields.
  - Run workflow submits inputs and renders server results.

## Acceptance Criteria

- A new default workflow contains one `Start` node with a readable id and at least one sample input field.
- The workbench prevents adding a second `Start` node.
- Users can configure Start fields in the inspector.
- Users can reference Start variables from LLM prompts with `{{start1.fieldName}}`.
- Running the workflow sends Start input values to the server.
- The server compiles and executes the supported graph with LangGraph JS.
- The server performs real OpenAI-compatible LLM calls using configured model settings.
- The run result shows per-node outputs and events.
- Optional Start fields with no value become `null`.
- Required missing Start fields fail before any model call.

## References

- Dify User Input node: https://docs.dify.ai/en/use-dify/nodes/user-input
- Dify LLM node: https://docs.dify.ai/en/use-dify/nodes/llm
- LangGraph JS documentation: https://langchain-ai.github.io/langgraphjs/
