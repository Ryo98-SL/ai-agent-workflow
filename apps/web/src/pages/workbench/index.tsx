import { AppWorkbench } from "@ai-agent-workflow/workbench-ui";
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { apiBaseUrl, workflowApi } from "../../lib/workflowApi";

export default function WorkbenchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialWorkflowId = searchParams.get("workflowId") ?? undefined;
  const handleWorkflowIdChange = useCallback(
    (workflowId: string | undefined) => {
      setSearchParams((current) => {
        if (current.get("workflowId") === (workflowId ?? null)) return current;
        const next = new URLSearchParams(current);
        if (workflowId) {
          next.set("workflowId", workflowId);
        } else {
          next.delete("workflowId");
        }
        return next;
      });
    },
    [setSearchParams],
  );

  return (
    <AppWorkbench
      workflowApi={workflowApi}
      apiBaseUrl={apiBaseUrl}
      showDevModelProviders={import.meta.env.DEV}
      initialWorkflowId={initialWorkflowId}
      onWorkflowIdChange={handleWorkflowIdChange}
    />
  );
}
