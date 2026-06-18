# Workbench UI Deep README

## Architecture

`packages/workbench-ui` owns the browser-compatible workbench UI. It imports
workflow schemas and run DTO types, but not Electron globals, server internals,
or runtime execution adapters.

Core responsibilities:

- `src/index.ts` exports the public component, data-provider hooks, account
  hooks, workflow hooks, provider-key store hook, theme/toast helpers, auth
  menu, theme menu, shared body-level `Popover`, shared workflow icon glyph, New
  Workflow template dialog, Knowledge Base creation dialog, and API boundary
  types.
- `src/workbench/AppWorkbench.tsx` owns workflow state, panel visibility,
  initial source loading, local/remote API switching, persistence calls, graph
  undo/redo ownership, workflow-level run calls, Chat Mode sends, provider-key
  preparation, New Workflow template loading, workflow-scoped Debug Session
  selection, unsaved switch handling, and host callbacks for active workflow id
  synchronization.
- `src/workbench/workflowDirtySnapshot.ts` owns the canonical content snapshot
  used for Save button dirty state.
- `src/workbench/components` owns the canvas-first shell, popovers, inspectors,
  model settings, Knowledge Base management, Tool Browser, variable rich-text
  editor, node palette, Chat Panel, run panel, and ReactFlow adapters.
- `src/components/ui` holds checked-in shadcn/ui primitives used by the
  workbench and dialogs.
- `src/data/useKnowledgeBases.ts` exposes React Query hooks for KB metadata and
  document mutations through the injected workbench API. Anonymous workflow
  storage stays local, but KB reads/mutations always delegate to the server
  boundary.
- `src/data/localWorkflowStore.ts` backs anonymous workflow CRUD with IndexedDB,
  migrates legacy localStorage records, and sends inline workflows to the server
  for execution. `useActiveWorkflowApi.ts` caches the anonymous adapter per
  injected server API so signed-out session refetches do not change the workflow
  source. `anonymousRunStore.ts` tracks anonymous run ids for session-scoped
  history while server memory still holds those runs.
- `src/auth/` owns the Better Auth menu and local-data import prompt shown when
  an anonymous user signs in. The Better Auth client disables focus-driven
  session refetches so returning to a tab does not call `get-session` or churn
  auth UI state.
- `src/theme/` owns the light/dark/system theme provider and menu.
- `src/i18n/` owns the package-level `workbench` namespace resources for
  Product Locale copy used by workbench UI surfaces.
- `src/workbench/assets` stores bundled DeepSeek, OpenAI, Anthropic, and
  Ollama provider logos so model UI never depends on external image URLs at
  runtime.
- `src/styles.css` exposes Tailwind/base styles for consuming apps.
- `tests/core-loop.test.tsx` covers the end-to-end UI loop with a mocked API.
  Additional tests cover anonymous session refresh behavior, node inspector
  behavior, shortcut focus rules, workflow dirty snapshots, and graph history.

Design constraints:

- The layout waits for the server workflow before mounting the canvas, avoiding
  a placeholder graph flash. It waits for session resolution before selecting
  the server-backed or anonymous IndexedDB workflow source, and then only
  bootstraps again when the auth identity changes or a workflow refresh is
  explicitly requested.
- Popovers use the shared Floating UI wrapper and mount under `body`; the
  header run history uses a backdrop-protected right drawer because it combines
  historical debug output and a selectable/deletable run list.
- User-visible dates must use the shared `formatWorkbenchDate` helper with
  Product Locale, not browser-default locales.
- ReactFlow nodes keep explicit dimensions and handle bounds; dynamic
  description, Start, and LLM content, including provider-logo sizing, must not
  shift handle positions.
- ReactFlow's built-in Controls are not used; the canvas owns bottom-right
  shadcn button groups under the MiniMap for history and viewport actions so
  styling stays aligned with the workbench.
- Source-handle palette additions create outgoing edges; target-handle additions
  create incoming edges and cannot create End nodes.
- Hovering a node highlights only its directly connected edges and remains local
  UI state.
- Inspector edits update node data without viewport resets or selection bounce.
- Header run history keeps historical debug details and the run list in one
  drawer container. The left pane reuses the read-only Debug Panel; the right
  pane shows date-first run rows with status icons and an inline delete confirm
  step. Keep the drawer portal-mounted under `document.body`, inset from the
  viewport as a rounded panel, and split the detail/list panes with `gap` rather
  than a touching border. History rows and confirm rows must use the same fixed
  height to avoid layout shift, row hover backgrounds must have vertical spacing
  between them, and raw run IDs should not be shown in the UI.
- The node inspector owns node identity editing in the panel header and
  description area, then separates node settings from selected-node run history
  with tabs. History uses compact Product Locale date + duration rows and
  reuses the same node-output detail renderer as the debug panel without
  repeating the selected node icon or label. During a workflow run, the
  inspector forces History active, disables Settings, and opens the latest
  history row. Inspector tab chrome, form labels, placeholders, action buttons,
  per-node model settings, and output variable headings come from the package
  `workbench` Product Locale namespace.
- Canvas undo/redo is operation-level and structural only: it covers node/edge
  creation, deletion, and node movement, but not inspector edits, LLM model
  overrides, global model settings, panel state, or run state.
- Header Save activation compares the current canonical workflow content
  snapshot with the last opened/saved baseline. The snapshot ignores workflow
  metadata and transient workflow-level `modelProvider.apiKey`; title,
  description, and icon changes are saved from `WorkflowMetaEditor` instead of
  activating the header Save button.
- Workflow switcher rows use the saved workflow summary icon, not a fixed icon,
  and keep row metadata editing adjacent to row deletion inside the popover.
- Host apps can pass `initialWorkflowId` to select a workflow from external
  state such as a URL, and `onWorkflowIdChange` to mirror internal workbench
  switches back to that external state. Keep routing dependencies in host apps,
  not inside this package.
- Edge selection is local UI state; edge deletion persists back to the workflow
  graph.
- DeepSeek is the normal model-settings fallback. OpenAI and Anthropic are
  selectable cloud providers. Ollama is hidden unless the host enables
  development providers. Workflow-level API keys are stored in the provider
  keyring and selected from provider groups; LLM node overrides reuse the same
  model settings panel and carry provider/model/endpoint plus advanced sampling
  settings, but not inline API keys. Model settings labels, selector chrome,
  custom-model actions, provider-key/credits copy, and the project Save control
  come from the package `workbench` Product Locale namespace. API-key creation
  uses the shared no-animation dialog, whose close affordance is rendered
  through the workbench `Button` component. Model search temporarily expands
  matching provider groups, and nested provider-key popovers should dismiss when
  users click elsewhere in the selector.
- Knowledge Base management stays in the header Settings popover via a shared
  dialog. The dialog reads the anonymous example KB, keeps private KB mutation
  actions disabled when signed out/read-only, supports pasted text and `.txt` /
  `.md` file ingestion, renders disabled platform embedding fields for the MVP,
  and sources creation-wizard chrome, field labels, settings labels, document
  empty states, and document actions from the `workbench` Product Locale
  namespace. The creation wizard is also exported for product-level entry points
  such as the web homepage; consumers must still wrap it in
  `WorkbenchDataProvider`. Knowledge node settings select one KB while
  persisting the array-shaped `knowledgeBaseIds` config, edit the query
  template, tune semantic retrieval limits, and render output variables.
- Chat Mode uses `workflow.settings.mode === "chat"`. `useWorkflowExecution`
  keeps Debug Sessions keyed by workflow, including each workflow's stable
  conversation id, transcript, turn count, latest debug state, and node execution
  state. SSE streams are keyed the same way, so switching workflows does not
  cancel an in-flight run or leak its node/debug events into the newly selected
  workflow. It sends user text as the `query` run field and derives assistant
  replies from the reached End node or the last LLM node. Start fields are gated
  once per conversation; "New conversation" resets transcript and memory thread
  for the active workflow. Summary-buffer settings live in workflow settings and
  are edited from the Chat Panel.
- Human Input nodes pause runs with a normalized interrupt. `resumeRun` keeps
  completed node state visible, posts the selected action/text, and subscribes
  to a fresh SSE leg on the same run.
- The New Workflow dialog reads localized templates from workflow-domain using
  the current Product Locale as Template Locale. Each template builds a valid
  unsaved `WorkflowFile`; the UI previews requirements, tags, and flow steps
  before loading the draft. Product shells can import it with
  `useCreateWorkflow` to create a selected template through the active workflow
  API and refresh the workflow list. Created workflows do not store a locale.
- Variable-bearing fields use `VariableRichTextEditor`, backed by Lexical. The
  canonical stored value remains the plain template string with
  `{{nodeId.path}}` placeholders; chips are editor presentation only. The `/`
  insertion menu anchors to Lexical's typeahead rect through Floating UI so it
  can flip and clamp its scrollable height to the available viewport space.
- Tool nodes are descriptor-driven. The palette drills into `ToolBrowser`, the
  inspector can rebind a tool, and `ToolParamForm` renders controls from
  workflow-domain param specs. Built-in descriptor display copy is localized in
  `localizedToolDescriptor` without changing server-facing identity.
- Workflow node cards localize display-only fallbacks such as effective-model
  placeholders, Human Input defaults, branch empty states, handle aria labels,
  and Agent tool counts in the rendering layer. Stored node labels, tool ids,
  branch ids, and workflow config remain locale-neutral.
- The right inspector panel width is user-resizable and persisted in
  localStorage by `useResizableWidth`.

## Test Strategy

Component tests render the full workbench with a memory workflow API. They
should cover user-visible behavior and API calls without browser fetch, Electron
preload APIs, or local runtime adapters. The test setup includes small DOM
polyfills for ReactFlow sizing and a minimal EventSource mock for stream-based
run rendering. Shared run output, Human Input resume, and node-output details
should be exercised through the debug panel, Chat Panel, or node inspector paths
rather than duplicated in separate fixtures.
