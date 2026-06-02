# Workbench UI

React workbench UI package for editing workflows and running server-backed
workflow runs through an injected workflow API. The shell keeps the React Flow
canvas as the primary workspace, with Start input editing, node creation, model
settings, node inspection, and run output available from floating controls and
a run-triggered canvas popover.

```tsx
import { AppWorkbench } from "@ai-agent-workflow/workbench-ui";
import "@xyflow/react/dist/style.css";
import "@ai-agent-workflow/workbench-ui/styles.css";

<AppWorkbench workflowApi={client} />;
```

Consumers provide a workflow API compatible with
`@ai-agent-workflow/workflow-client`.
