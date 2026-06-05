import { AppWorkbench } from "@ai-agent-workflow/workbench-ui";
import { apiBaseUrl, workflowApi } from "../lib/workflowApi";

export default function WorkbenchPage() {
  return <AppWorkbench workflowApi={workflowApi} apiBaseUrl={apiBaseUrl} showDevModelProviders={import.meta.env.DEV} />;
}
