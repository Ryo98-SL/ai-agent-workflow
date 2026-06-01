import React from "react";
import ReactDOM from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "@ai-agent-workflow/workbench-ui/styles.css";
import { AppWorkbench } from "@ai-agent-workflow/workbench-ui";
import { createWorkflowClient } from "@ai-agent-workflow/workflow-client";

const workflowApi = createWorkflowClient({
  baseUrl: import.meta.env.VITE_WORKFLOW_API_BASE_URL ?? "http://127.0.0.1:8788",
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppWorkbench workflowApi={workflowApi} />
  </React.StrictMode>,
);
