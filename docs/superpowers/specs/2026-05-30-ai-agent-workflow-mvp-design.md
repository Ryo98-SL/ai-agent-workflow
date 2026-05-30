# AI Agent Workflow MVP Design

Date: 2026-05-30

## Summary

Build a local desktop AI Agent workflow workbench for developers. The product borrows the visual workflow style of Coze and Dify, but the MVP narrows the first success criterion to LLM node debugging: a developer can create an LLM node on a canvas, configure an OpenAI-compatible model, edit prompts with variables, run that node independently, and inspect the resolved prompt, request, response, latency, and errors.

The MVP should create a solid foundation for a future LangGraph JS workflow runner without requiring complete workflow execution in the first version.

## Target User

The first target user is a developer or Agent engineer who wants to prototype, inspect, and debug AI workflow nodes locally.

Primary job to be done:

- Visually create an LLM node in a workflow.
- Configure an OpenAI-compatible model endpoint.
- Edit system and user prompts.
- Provide test variables.
- Run the LLM node by itself.
- Inspect the generated prompt, model output, timing, and errors.
- Save the workflow as a local file that can be versioned.

## Non-Goals

The MVP will not include:

- User accounts, teams, roles, or cloud sync.
- Workflow publishing or deployment.
- Plugin marketplace.
- Full knowledge-base ingestion and retrieval.
- Complete Coze/Dify feature parity.
- Complete LangGraph workflow execution for every node type.
- Python LangGraph runtime.
- Complex custom tool schema management.

## Technology Choices

- Desktop shell: Electron Forge.
- UI: React and TypeScript.
- Canvas: ReactFlow.
- Styling: Tailwind CSS and shadcn/ui.
- Runtime language: TypeScript.
- Future workflow runtime: LangGraph JS.
- Model API shape: OpenAI-compatible API with configurable `baseURL`, `apiKey`, and `model`.
- Persistence: local workflow files, starting with JSON.

## Recommended MVP Approach

Use a prompt-debugging core with a workflow workbench skeleton.

The app should look and behave like the beginning of a full workflow builder, but the first complete capability is LLM node debugging. Other node types appear in the palette and schema so the workflow model is extensible, but only the LLM node needs a polished real execution path in the MVP.

This approach keeps the product direction visible while controlling implementation risk.

## Product Scope

MVP capabilities:

- Electron desktop app with React workbench.
- Dify/Coze-style workspace:
  - left node palette,
  - center ReactFlow canvas,
  - right node inspector,
  - bottom debug panel.
- Node palette with:
  - `Start`,
  - `LLM`,
  - `Knowledge`,
  - `Tool`,
  - `Code`,
  - `If/Else`,
  - `Template`,
  - `End`.
- Real first-class support for `LLM` node configuration and single-node execution.
- OpenAI-compatible model settings.
- Local `.agentflow.json` save and load.
- Runtime service boundary that can later move behind Electron IPC or a LangGraph runner.
- Initial Tool node pathway with at least one built-in real tool adapter, preferably current time. HTTP request and JavaScript function execution can follow after the LLM path is stable.

## Architecture

### 1. Electron App Shell

Electron Forge owns application startup, windows, and desktop packaging.

The main process should expose a small preload-safe API for:

- opening a workflow file,
- saving a workflow file,
- reading local app settings,
- writing local app settings.

The renderer should not access Node.js filesystem APIs directly.

API keys can initially live in local app settings for MVP speed. The design should keep this storage behind an app settings interface so it can later move to the system keychain without rewriting UI components.

### 2. Workflow Designer

The React renderer owns the interactive workbench.

ReactFlow manages visual graph interactions:

- node rendering,
- edge creation,
- dragging,
- zooming,
- selection.

React components should not store workflow information in ad hoc view-only formats. Canvas state, inspector state, and file persistence should all read from and write to a shared workflow schema.

### 3. Node Runtime Adapters

Execution behavior is separated by node type.

The MVP needs a real `LLMNodeAdapter`. It receives:

- selected LLM node config,
- test variable values,
- global OpenAI-compatible model settings.

It returns a normalized debug result containing:

- status,
- resolved prompt,
- request summary,
- response text,
- raw response summary,
- latency,
- normalized error when applicable.

Other node adapters can start as stubs or mock adapters. The boundary should make it obvious whether a node type is executable, mock-only, or configuration-only.

### 4. LangGraph Bridge

The MVP should define the boundary between the app workflow schema and a future LangGraph JS executable graph.

The first version does not need to compile and execute the whole workflow through LangGraph. It should provide types and interfaces that make the later path clear:

- `WorkflowGraph` as the persisted graph representation.
- `ExecutableGraph` or equivalent runtime representation.
- adapter metadata describing which node types can be executed.
- a future compiler path from workflow schema to LangGraph JS.

## Data Flow

Basic edit and debug flow:

1. User opens the app.
2. User creates or opens a `.agentflow.json` file.
3. User drags an `LLM` node onto the canvas.
4. ReactFlow updates the workflow schema.
5. User selects the LLM node.
6. The right inspector edits the node config.
7. User configures model settings.
8. User enters test variable values.
9. User runs the selected LLM node.
10. Runtime service resolves prompt variables.
11. Runtime service sends an OpenAI-compatible request.
12. Debug panel displays prompt, request summary, response, latency, and errors.
13. User saves the workflow to disk.

## UI Components

Recommended component structure:

- `AppWorkbench`: overall layout and top-level workflow state.
- `NodePalette`: left node library grouped by Basic, AI, Logic, and Tools.
- `WorkflowCanvas`: ReactFlow canvas, node renderer, edge renderer, selection handling.
- `NodeInspector`: right panel that switches by selected node type.
- `LLMInspector`: model override, prompt editor, variables, temperature, and max token settings.
- `DebugPanel`: bottom panel for single-node test input, resolved prompt, request, response, latency, and errors.
- `ProjectFileActions`: open, save, save as, dirty state, file path display.
- `ModelSettingsPanel`: global OpenAI-compatible settings.

The first screen should be the actual workbench, not a landing page.

## Workflow File Format

Use `.agentflow.json` for the first MVP. JSON is readable, diffable, easy to validate, and friendly to version control.

Initial structure:

```ts
type WorkflowFile = {
  version: "1";
  metadata: {
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  };
  graph: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  settings: {
    modelProvider?: OpenAICompatibleSettings;
  };
};

type OpenAICompatibleSettings = {
  baseURL: string;
  apiKey?: string;
  model: string;
};

type WorkflowNode =
  | StartNode
  | LLMNode
  | TemplateNode
  | ToolNode
  | CodeNode
  | IfElseNode
  | KnowledgeNode
  | EndNode;

type LLMNode = {
  id: string;
  type: "llm";
  position: { x: number; y: number };
  label: string;
  config: {
    systemPrompt?: string;
    userPrompt: string;
    variables: Record<string, string>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
};
```

The schema should be validated when loading files. Unsupported versions should produce a clear error instead of attempting partial load. `apiKey` is optional in the file schema so users can avoid committing secrets, but it is required at runtime unless the selected compatible endpoint does not require authentication.

## LLM Node Debugging

The LLM node is the primary MVP feature.

It should support:

- system prompt,
- user prompt,
- variable placeholders,
- per-node model override,
- temperature,
- max tokens,
- single-node test variables,
- run button,
- resolved prompt preview,
- response display,
- latency display,
- normalized error display.

Single-node execution does not require a complete graph run. It can execute with only:

- the selected node config,
- global or overridden model config,
- provided test variables.

## Model Integration

Use OpenAI-compatible chat completions first.

Required settings:

- `baseURL`,
- `apiKey`,
- `model`.

The adapter should not hard-code a provider. This allows users to point the app at OpenAI, DeepSeek, Qwen, Moonshot, local gateways, or compatible proxy services.

The request and response logic should live in a service or adapter, not inside React components.

## Tool Node Direction

Tool nodes are part of the palette and schema because they are central to Agent workflows. The MVP should keep their implementation small.

Initial built-in tool scope:

- current time must be available as a real built-in tool adapter in the MVP,
- HTTP request is the next candidate after the LLM path is stable,
- simple JavaScript function execution is useful later but should not delay the MVP.

The Tool node exists to validate that the runtime adapter boundary can support non-LLM execution. It should remain secondary to the LLM debugging experience.

## Error Handling

Errors should be normalized into user-readable categories:

- missing model configuration,
- missing prompt variable,
- template parsing failure,
- network timeout,
- authentication failure,
- rate limit,
- upstream server error,
- non-compatible API response,
- invalid workflow JSON,
- unsupported workflow schema version,
- file read or write failure,
- unsupported node execution.

The debug panel should keep the latest run state:

- `idle`,
- `running`,
- `success`,
- `error`.

For errors, the UI should show:

- clear summary,
- likely cause,
- raw error summary where useful,
- copyable request or response details when available.

## Testing Strategy

Use three layers of tests.

### Unit Tests

Cover:

- workflow file schema parsing,
- workflow file validation,
- prompt variable resolution,
- missing variable detection,
- OpenAI-compatible request construction,
- response normalization,
- error normalization.

### Component Tests

Cover:

- `LLMInspector` updates node config correctly,
- `DebugPanel` displays idle, running, success, and error states,
- model settings form validates required fields,
- selected node changes update the inspector.

### End-to-End Smoke Test

Cover the core loop:

1. Start the app.
2. Create a workflow.
3. Add or select an LLM node.
4. Configure model settings.
5. Edit prompt.
6. Enter test variables.
7. Run the node against a mock OpenAI-compatible server.
8. See resolved prompt and model response in the debug panel.
9. Save the workflow.
10. Reopen the workflow and confirm config is restored.

The smoke test should use a mock server rather than a real API key.

## Acceptance Criteria

The MVP is complete when:

1. A user can create or open a `.agentflow.json` workflow file.
2. A user can see the workbench with node palette, canvas, inspector, and debug panel.
3. A user can add or select an `LLM` node.
4. A user can configure OpenAI-compatible model settings.
5. A user can edit system prompt, user prompt, variables, and basic model parameters.
6. A user can run the selected LLM node independently.
7. The app displays resolved prompt, response, latency, and normalized errors.
8. A user can save the workflow and reopen it with node configuration preserved.
9. A user can run at least one built-in Tool node adapter, starting with current time.
10. Non-LLM nodes can exist in the palette and schema without blocking the LLM debugging flow.
11. The codebase contains a clear runtime adapter boundary for future LangGraph JS integration.

## Implementation Notes

Recommended first build order:

1. Scaffold Electron Forge, React, TypeScript, Tailwind CSS, shadcn/ui, and ReactFlow.
2. Define workflow schema and validation.
3. Build the workbench shell.
4. Build ReactFlow canvas and node palette.
5. Build LLM inspector and model settings.
6. Build prompt variable resolver.
7. Build OpenAI-compatible LLM adapter.
8. Build debug panel.
9. Add file open/save through Electron IPC.
10. Add tests around schema, prompt resolution, adapter behavior, and the core UI loop.

## Open Decisions Already Resolved

- Primary user: developers and Agent engineers.
- Product reference: Coze and Dify workflow builders.
- MVP strategy: prompt-debugging core with workflow skeleton.
- Execution mode: hybrid; mock runner plus real LLM adapter, with future LangGraph JS bridge.
- Node family: Dify/Coze-style general workflow nodes.
- First debugging priority: Prompt and model debugging.
- Model support: OpenAI-compatible API.
- Persistence: local workflow files.
- Runtime language: TypeScript.
- LangGraph route: LangGraph JS.
- Tool node strategy: at least one built-in real tool adapter in the MVP, starting with current time.
- Main layout: three-column workbench with bottom debug panel.
