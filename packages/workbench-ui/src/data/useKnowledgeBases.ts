import type {
  CreateFileKnowledgeDocumentRequest,
  CreateKnowledgeBaseRequest,
  CreateTextKnowledgeDocumentRequest,
  UpdateKnowledgeBaseRequest,
} from "@ai-agent-workflow/api-contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkflowApi } from "./useActiveWorkflowApi";

export const knowledgeQueryKeys = {
  bases: ["knowledge-bases"] as const,
  base: (id: string) => ["knowledge-base", id] as const,
  documents: (knowledgeBaseId: string) => ["knowledge-base-documents", knowledgeBaseId] as const,
};

export function useKnowledgeBases() {
  const workflowApi = useActiveWorkflowApi();
  return useQuery({
    queryKey: knowledgeQueryKeys.bases,
    queryFn: () => workflowApi.listKnowledgeBases(),
  });
}

export function useKnowledgeBase(id?: string | null) {
  const workflowApi = useActiveWorkflowApi();
  return useQuery({
    queryKey: id ? knowledgeQueryKeys.base(id) : ["knowledge-base", "none"],
    queryFn: () => workflowApi.getKnowledgeBase(id as string),
    enabled: Boolean(id),
  });
}

export function useKnowledgeBaseDocuments(knowledgeBaseId?: string | null) {
  const workflowApi = useActiveWorkflowApi();
  return useQuery({
    queryKey: knowledgeBaseId ? knowledgeQueryKeys.documents(knowledgeBaseId) : ["knowledge-base-documents", "none"],
    queryFn: () => workflowApi.listKnowledgeBaseDocuments(knowledgeBaseId as string),
    enabled: Boolean(knowledgeBaseId),
  });
}

export function useCreateKnowledgeBase() {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateKnowledgeBaseRequest) => workflowApi.createKnowledgeBase(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.bases }),
  });
}

export function useUpdateKnowledgeBase() {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateKnowledgeBaseRequest }) =>
      workflowApi.updateKnowledgeBase(id, request),
    onSuccess: ({ knowledgeBase }) => {
      queryClient.setQueryData(knowledgeQueryKeys.base(knowledgeBase.id), { knowledgeBase });
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.bases });
    },
  });
}

export function useDeleteKnowledgeBase() {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowApi.deleteKnowledgeBase(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.bases }),
  });
}

export function useCreateTextKnowledgeDocument() {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ knowledgeBaseId, request }: { knowledgeBaseId: string; request: CreateTextKnowledgeDocumentRequest }) =>
      workflowApi.createTextKnowledgeDocument(knowledgeBaseId, request),
    onSuccess: ({ document }) => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents(document.knowledgeBaseId) });
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.bases });
    },
  });
}

export function useCreateFileKnowledgeDocument() {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ knowledgeBaseId, request }: { knowledgeBaseId: string; request: CreateFileKnowledgeDocumentRequest }) =>
      workflowApi.createFileKnowledgeDocument(knowledgeBaseId, request),
    onSuccess: ({ document }) => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents(document.knowledgeBaseId) });
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.bases });
    },
  });
}

export function useDeleteKnowledgeDocument(knowledgeBaseId?: string | null) {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowApi.deleteKnowledgeDocument(id),
    onSuccess: () => {
      if (knowledgeBaseId) {
        queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents(knowledgeBaseId) });
      }
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.bases });
    },
  });
}

export function useReindexKnowledgeDocument(knowledgeBaseId?: string | null) {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowApi.reindexKnowledgeDocument(id),
    onSuccess: ({ document }) => {
      queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents(knowledgeBaseId ?? document.knowledgeBaseId) });
    },
  });
}
