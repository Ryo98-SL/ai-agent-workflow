# Workbench UI

Reusable React workbench for editing workflows and running them through an
injected workflow API. React Flow is the primary workspace; node creation, model
settings, inspection, and run output live in floating panels.

Principles:

- Keep workflow persistence and runs behind the injected API.
- Keep popovers mounted under `body` so canvas containers cannot clip them.
- Keep node handle behavior direction-aware: source creates outgoing edges,
  target creates incoming edges.
- Show important canvas state in-place: Start inputs, LLM effective model with
  bundled provider logo, and selected-node feedback.
- Keep undo/redo scoped to canvas structure edits: node/edge creation,
  deletion, and node movement, without rolling back inspector or model settings.
  Canvas history and viewport actions live in bottom-right button groups under
  the MiniMap.
- Enable Save only when the current workflow content differs from the last
  opened or saved baseline, so undo/redo can return Save to the correct state.
- Keep node inspection focused: the panel header edits the node label, the body
  edits the description without a framed field, and Settings / History tabs
  separate configuration from run output. History queries all runs for the open
  workflow and filters them to the selected node, using compact English-format
  date/duration rows instead of repeating the selected node header. While a
  workflow is running, Settings is locked and History opens the latest row.
- Keep historical run viewing isolated: selecting a run from the header history
  opens a read-only Debug Panel that renders the historical output without
  showing Start inputs, replacing live debug state, or mutating the current
  workflow.
- Keep model configuration consistent: global settings and LLM node overrides
  share the same provider/model/API key editor, with node advanced settings for
  temperature and max tokens.

```tsx
import { AppWorkbench } from "@ai-agent-workflow/workbench-ui";
import "@xyflow/react/dist/style.css";
import "@ai-agent-workflow/workbench-ui/styles.css";

<AppWorkbench workflowApi={client} />;
```

Consumers provide a workflow API compatible with
`@ai-agent-workflow/workflow-client`. DeepSeek, OpenAI, and Anthropic are
available by default with local logo assets; pass `showDevModelProviders` to
expose development providers such as Ollama. Provider API keys are edited per
provider, and LLM nodes can override provider, model, base URL, API key,
temperature, and max tokens. The node inspector and read-only run history reuse
the run output renderer from the debug panel so selected nodes and historical
runs show the same card details as the workflow run log.
