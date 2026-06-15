import { useEffect } from "react";
import type { CreateMcpServerRequest, UpdateMcpServerRequest } from "@ai-agent-workflow/api-contracts";
import { registerMcpToolDescriptors } from "@ai-agent-workflow/workflow-domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkflowApi } from "./useActiveWorkflowApi";

/**
 * Account-level MCP server hooks (ADR 0004). The list is fetched for everyone: the
 * read-only Built-in MCP Server (ADR 0006) is returned to anonymous callers too, and a
 * signed-in user's own servers are appended. On every load it mirrors the fetched
 * snapshot tools into the client-only domain registry via {@link registerMcpToolDescriptors}
 * so the Tool Browser, inspectors, and node cards resolve MCP tools **synchronously** and
 * render offline. The server never injects this global (multi-tenant safety).
 */
export const mcpQueryKeys = {
  servers: ["mcp-servers"] as const,
};

export function useMcpServers() {
  const workflowApi = useActiveWorkflowApi();
  const query = useQuery({
    queryKey: mcpQueryKeys.servers,
    queryFn: () => workflowApi.listMcpServers(),
  });

  // Keep the client-only MCP descriptor registry in sync with the loaded snapshots
  // (the built-in server's tools register for anonymous visitors too).
  const servers = query.data?.servers;
  useEffect(() => {
    registerMcpToolDescriptors(servers ? servers.flatMap((server) => server.tools) : []);
  }, [servers]);

  return query;
}

export function useCreateMcpServer() {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateMcpServerRequest) => workflowApi.createMcpServer(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpQueryKeys.servers }),
  });
}

export function useUpdateMcpServer() {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateMcpServerRequest }) =>
      workflowApi.updateMcpServer(id, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpQueryKeys.servers }),
  });
}

export function useRefreshMcpServer() {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowApi.refreshMcpServer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpQueryKeys.servers }),
  });
}

export function useDeleteMcpServer() {
  const workflowApi = useActiveWorkflowApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowApi.deleteMcpServer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mcpQueryKeys.servers }),
  });
}
