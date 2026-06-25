import type { CreateCustomModelRequest } from "@ai-agent-workflow/api-contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkbenchAuthClient, useWorkbenchData } from "./WorkbenchDataProvider";

export const accountQueryKeys = {
  session: ["session"] as const,
  providerKeys: ["provider-keys"] as const,
  customModels: ["custom-models"] as const,
  credits: ["credits"] as const,
  creditProviders: ["credit-providers"] as const,
  embeddingInfo: ["embedding-info"] as const,
  emailCapability: (userId: string) => ["email-capability", userId] as const,
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

export function useCreateProviderKey() {
  const { workflowApi } = useWorkbenchData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, label, apiKey }: { provider: string; label: string; apiKey: string }) =>
      workflowApi.createProviderKey({ provider, label, apiKey }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountQueryKeys.providerKeys }),
  });
}

export function useDeleteProviderKey() {
  const { workflowApi } = useWorkbenchData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowApi.deleteProviderKey(id),
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

// --- Credits ---------------------------------------------------------------

export function useCredits() {
  const { workflowApi } = useWorkbenchData();
  const enabled = useIsAuthed();
  return useQuery({
    queryKey: accountQueryKeys.credits,
    queryFn: () => workflowApi.getCredits(),
    enabled,
  });
}

/**
 * Providers the platform funds with AI credits (a server-side key is
 * configured). Public, non-sensitive config; fetched regardless of auth and
 * cached long since it only changes on deploy.
 */
export function useCreditProviders() {
  const { workflowApi } = useWorkbenchData();
  return useQuery({
    queryKey: accountQueryKeys.creditProviders,
    queryFn: () => workflowApi.getCreditProviders(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The platform embedding provider/model the server runs (from `EMBEDDING_*` env), or
 * `embedding: null` when unconfigured. Public, non-sensitive; cached long since it only
 * changes on deploy. The KB UI uses it to show the active embedding model.
 */
export function useEmbeddingInfo() {
  const { workflowApi } = useWorkbenchData();
  return useQuery({
    queryKey: accountQueryKeys.embeddingInfo,
    queryFn: () => workflowApi.getEmbeddingInfo(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Public email provider/quota status, scoped by the current auth identity. */
export function useEmailCapability() {
  const { workflowApi } = useWorkbenchData();
  const { data } = useSession();
  const userId = data?.user?.id ?? "anonymous";
  return useQuery({
    queryKey: accountQueryKeys.emailCapability(userId),
    queryFn: () => workflowApi.getEmailCapability(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useApplyCredits() {
  const { workflowApi } = useWorkbenchData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => workflowApi.applyCredits(),
    onSuccess: (status) => queryClient.setQueryData(accountQueryKeys.credits, status),
  });
}
