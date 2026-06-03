# Workbench UI

React workbench UI package for editing workflows and running server-backed
workflow runs through an injected workflow API. The shell keeps the React Flow
canvas as the primary workspace, with Start input editing, node creation, model
settings, node inspection, and run output available from floating controls and
a run-triggered canvas popover. Canvas controls use square-rounded icon buttons,
including an icon-only Run control, and canvas nodes keep their connection
handles aligned with rendered edge endpoints. Node handles expose inline add
buttons that open the node palette beside the handle and connect newly created
nodes according to the clicked handle direction. Target-handle creation wires
the new node into the clicked node, while source-handle creation wires the
clicked node into the new node. React Flow node rendering is split by
workflow node type, with type-colored icon backgrounds shown beside each node
title and in node palettes. Start nodes preview declared input fields and the
node description on the canvas. The node palette, model settings, model
selector, and run log popovers are anchored with floating-ui and mounted under
`body` so they are not clipped by canvas layout containers.

```tsx
import { AppWorkbench } from "@ai-agent-workflow/workbench-ui";
import "@xyflow/react/dist/style.css";
import "@ai-agent-workflow/workbench-ui/styles.css";

<AppWorkbench workflowApi={client} />;
```

Consumers provide a workflow API compatible with
`@ai-agent-workflow/workflow-client`. Pass `showDevModelProviders` to expose
development-only model providers such as Ollama in the model selector; DeepSeek
is available by default. DeepSeek API keys stay in browser memory: save/open
payloads omit them, while run requests pass the current key as transient model
settings.
