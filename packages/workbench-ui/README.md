# Workbench UI

Reusable React workbench for editing workflows and running them through an
injected workflow API. React Flow is the primary workspace; node creation, model
settings, inspection, and run output live in floating panels.

Principles:

- Keep workflow persistence and runs behind the injected API.
- Route anonymous workflow CRUD through IndexedDB while delegating execution,
  Knowledge Bases, account, and credits to the injected server API.
- Keep signed-out session refreshes from reloading the active local workflow, so
  unsaved anonymous edits survive tab focus/session checks.
- Do not refetch Better Auth session merely because the browser tab regains
  focus; explicit auth changes and workflow refreshes should drive reloads.
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
- Let host apps synchronize the active workflow id with their own URL/state by
  passing `initialWorkflowId` and `onWorkflowIdChange`; the workbench package
  does not import router APIs directly.
- Keep node inspection focused: the panel header edits the node label, the body
  edits the description without a framed field, and Settings / History tabs
  separate configuration from run output. History queries all runs for the open
  workflow and filters them to the selected node, using compact Product Locale
  date/duration rows instead of repeating the selected node header. While a
  workflow is running, Settings is locked and History opens the latest row.
- Keep historical run viewing isolated: the header history button opens a
  backdrop-protected right drawer with read-only run output on the left and the
  run list on the right. The drawer is a body-level portal, inset from the
  viewport with rounded corners, and separates detail/list panes with real gap
  spacing. Rows use Product Locale date labels, hide raw run IDs, support
  same-height inline delete confirmation, and do not replace live debug state or
  mutate the workflow.
- Keep model configuration consistent: global settings and LLM node overrides
  share the same provider/model/endpoint/Advanced panel. Provider API keys are
  selected from model groups instead of inline model-setting fields. API-key add
  flows use the shared product-themed dialog without modal entrance animation.
  Model selector, custom-model, provider-key, credits, and save controls use
  Product Locale copy from the `workbench` namespace.
- Keep Knowledge Base management in the global settings surface: the dialog
  lists the anonymous Chinese example KB, manages authenticated private KBs and
  text documents, the creation wizard uses Product Locale for wizard chrome and
  field labels, and the Knowledge node inspector selects one reusable KB for
  semantic retrieval.
- Keep Chat Mode separate from one-shot workflow runs: Start fields are collected
  once per conversation, each message is sent as `query`, and Human Input pauses
  render the same resume form in chat, inspector history, and debug surfaces.
- Keep Debug Sessions scoped to workflows: switching workflows restores that
  workflow's run output and Chat Mode transcript, or shows an empty debug panel
  when the target workflow has not run in the current browser session. Runs keep
  streaming into their own workflow session after the user switches away.
- Keep variable authoring structured: prompt-like fields use Lexical variable
  chips, `/` insertion, and upstream Available Variables from workflow-domain;
  the slash menu flips and resizes to stay inside the viewport.
- Keep Tool nodes descriptor-driven: the Tool Browser selects a registry entry
  and the inspector renders params from the tool descriptor instead of hard-coded
  per-tool forms.
- Keep Product Locale copy in the package-owned `workbench` namespace. Display
  localization for Tool descriptors is applied in the rendering layer and does
  not mutate stored tool identity or workflow config. Node Inspector forms,
  workflow node card fallbacks, output variable chrome, and Workbench timestamps
  use Product Locale through the shared workbench i18n/date helpers.

```tsx
import { AppWorkbench, WorkbenchDataProvider } from "@ai-agent-workflow/workbench-ui";
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

The package also exports the shared data provider, session/workflow hooks,
themed toaster, theme provider, theme menu, auth menu, shared workflow icon
glyph, New Workflow template dialog, Knowledge Base creation dialog, and
`workbenchI18nResources` so host apps can build product-level shells without
duplicating workbench internals.
