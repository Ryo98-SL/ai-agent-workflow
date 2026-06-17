import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkflowFile } from "@ai-agent-workflow/workflow-domain";
import { useActiveWorkflowApi } from "./useActiveWorkflowApi";
import { useSession } from "./useAccount";

/**
 * Reactive list of the current user's workflows (server when signed in, local
 * IndexedDB when anonymous). Keyed by auth state so switching identity refetches.
 * Invalidate `["workflows"]` after create/update/delete to refresh.
 */
export function useWorkflows() {
  const workflowApi = useActiveWorkflowApi();
  const { data, isPending } = useSession();
  const isAuthed = Boolean(data?.user);

  return useQuery({
    queryKey: ["workflows", isAuthed],
    queryFn: () => workflowApi.listWorkflows(),
    enabled: !isPending,
  });
}

export function useCreateWorkflow() {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workflow?: WorkflowFile) => workflowApi.createWorkflow(workflow ? { workflow } : undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}

/**
 * Run history for a workflow. Authed → durable (Postgres); anonymous →
 * session-scoped (server memory) via the local adapter. staleTime 0 so opening
 * the history menu always reflects the latest run.
 */
export function useWorkflowRuns(workflowId: string | undefined) {
  const workflowApi = useActiveWorkflowApi();
  return useQuery({
    queryKey: ["workflow-runs", workflowId ?? ""],
    queryFn: () => workflowApi.listWorkflowRuns(workflowId as string),
    enabled: Boolean(workflowId),
    staleTime: 0,
  });
}

export function useDeleteWorkflowRun(workflowId: string | undefined) {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => workflowApi.deleteRun(runId),
    onSuccess: () => {
      if (workflowId) {
        void queryClient.invalidateQueries({ queryKey: ["workflow-runs", workflowId] });
      }
    },
  });
}
