# Workbench UI

Reusable React workbench for editing workflows and running them through an
injected workflow API. React Flow is the primary workspace; node creation, model
settings, inspection, and run output live in floating panels.

Principles:

- Keep workflow persistence and runs behind the injected API.
- Route anonymous workflow CRUD through IndexedDB while delegating execution,
  Knowledge Bases, account, and credits to the injected server API.
- Keep popovers mounted under `body` so canvas containers cannot clip them.
- Keep node handle behavior direction-aware: source creates outgoing edges,
  target creates incoming edges.
- Show important canvas state in-place: node descriptions, Start inputs, LLM
  effective model with bundled provider logo, and selected-node feedback.
- Keep undo/redo scoped to canvas structure edits: node/edge creation,
  deletion, and node movement, without rolling back inspector or model settings.
  Canvas history and viewport actions live in bottom-right button groups under
  the MiniMap.
- Enable the header Save only when workflow graph/settings content differs from
  the last opened or saved baseline. Workflow title, description, and icon are
  saved from their own metadata editor.
- Keep workflow switching row-oriented: the popover list shows each workflow's
  saved icon and places metadata edit actions beside delete actions.
- Keep node inspection focused: the panel header edits the node label, the body
  edits the description without a framed field, and Settings / History tabs
  separate configuration from run output. History queries all runs for the open
  workflow and filters them to the selected node, using compact English-format
  date/duration rows instead of repeating the selected node header. While a
  workflow is running, Settings is locked and History opens the latest row.
- Keep historical run viewing isolated: the header history button opens a
  backdrop-protected right drawer with read-only run output on the left and the
  run list on the right. The drawer is a body-level portal, inset from the
  viewport with rounded corners, and separates detail/list panes with real gap
  spacing. Rows use shared English-format date labels, hide raw run IDs, support
  same-height inline delete confirmation, and do not replace live debug state or
  mutate the workflow.
- Keep model configuration consistent: global settings and LLM node overrides
  share the same provider/model/endpoint/Advanced panel. Provider API keys are
  selected from model groups instead of inline model-setting fields. API-key add
  flows use the shared product-themed dialog without modal entrance animation.
- Keep Knowledge Base management in the global settings surface: the dialog
  lists the anonymous Chinese example KB, manages authenticated private KBs and
  text documents, and the Knowledge node inspector selects one reusable KB for
  semantic retrieval.
- Keep Chat Mode separate from one-shot workflow runs: Start fields are collected
  once per conversation, each message is sent as `query`, and Human Input pauses
  render the same resume form in chat, inspector history, and debug surfaces.
- Keep variable authoring structured: prompt-like fields use Lexical variable
  chips, `/` insertion, and upstream Available Variables from workflow-domain.
- Keep Tool nodes descriptor-driven: the Tool Browser selects a registry entry
  and the inspector renders params from the tool descriptor instead of hard-coded
  per-tool forms.

```tsx
import { AppWorkbench } from "@ai-agent-workflow/workbench-ui";
import "@xyflow/react/dist/style.css";
import "@ai-agent-workflow/workbench-ui/styles.css";

<AppWorkbench workflowApi={client} />;
```

Consumers provide a workflow API compatible with
`@ai-agent-workflow/workflow-client` and pass the API base URL so Better Auth can
share the same origin. DeepSeek, OpenAI, and Anthropic are available by default
with local logo assets; pass `showDevModelProviders` to expose development
providers such as Ollama. Provider API keys are edited per provider, and LLM
nodes can override provider, model, base URL, temperature, and max tokens. The
node inspector and read-only run history reuse the run output renderer from the
debug panel so selected nodes and historical runs show the same card details as
the workflow run log. LLM, Knowledge, Tool, Human Input, and Template authoring
surfaces show output variables so downstream prompt references can be authored
from the same panel.
