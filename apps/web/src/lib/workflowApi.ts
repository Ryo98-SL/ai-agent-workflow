import { createWorkflowClient } from "@ai-agent-workflow/workflow-client";

export const apiBaseUrl = import.meta.env.VITE_WORKFLOW_API_BASE_URL ?? "http://127.0.0.1:8788";

export const workflowApi = createWorkflowClient({ baseUrl: apiBaseUrl });
