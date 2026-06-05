import type { CreateCustomModelRequest } from "@ai-agent-workflow/api-contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkbenchAuthClient, useWorkbenchData } from "./WorkbenchDataProvider";

export const accountQueryKeys = {
  session: ["session"] as const,
  providerKeys: ["provider-keys"] as const,
  customModels: ["custom-models"] as const,
  workflowRuns: (workflowId: string) => ["workflow-runs", workflowId] as const,
};

/** Better Auth reactive session. `data` is null when signed out. */
export function useSession() {
  const authClient = useWorkbenchAuthClient();
  return authClient.useSession();
}

function useIsAuthed(): boolean {
  const { data } = useSession();
  return Boolean(data?.user);
}

// --- Provider keys (masked) ------------------------------------------------

export function useProviderKeys() {
  const { workflowApi } = useWorkbenchData();
  const enabled = useIsAuthed();
  return useQuery({
    queryKey: accountQueryKeys.providerKeys,
    queryFn: () => workflowApi.listProviderKeys(),
    enabled,
  });
}

export function usePutProviderKey() {
  const { workflowApi } = useWorkbenchData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: string; apiKey: string }) =>
      workflowApi.putProviderKey(provider, { apiKey }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountQueryKeys.providerKeys }),
  });
}

export function useDeleteProviderKey() {
  const { workflowApi } = useWorkbenchData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => workflowApi.deleteProviderKey(provider),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountQueryKeys.providerKeys }),
  });
}

// --- Custom models ---------------------------------------------------------

export function useCustomModels() {
  const { workflowApi } = useWorkbenchData();
  const enabled = useIsAuthed();
  return useQuery({
    queryKey: accountQueryKeys.customModels,
    queryFn: () => workflowApi.listCustomModels(),
    enabled,
  });
}

export function useCreateCustomModel() {
  const { workflowApi } = useWorkbenchData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateCustomModelRequest) => workflowApi.createCustomModel(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountQueryKeys.customModels }),
  });
}

export function useDeleteCustomModel() {
  const { workflowApi } = useWorkbenchData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowApi.deleteCustomModel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountQueryKeys.customModels }),
  });
}
