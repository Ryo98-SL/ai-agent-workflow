import { builtinMcpConnection } from "./builtin";
import type { McpServerConnection } from "./client";
import type { McpRepository } from "./repository";

/**
 * Loads the signed-in user's MCP server connections (with decrypted headers) for an
 * Agent node's live MCP tools. Resolved lazily per run — the agent only connects the
 * servers its tool bindings actually reference.
 */
async function loadUserMcpConnections(repo: McpRepository, userId: string): Promise<McpServerConnection[]> {
  const servers = await repo.list(userId);
  const connections = await Promise.all(servers.map((server) => repo.getConnection(userId, server.id)));
  return connections.filter((connection): connection is McpServerConnection => connection !== null);
}

/**
 * MCP connections injected into every run (ADR 0006): the auth-less built-in server is
 * always present; a signed-in user's own servers are appended. Anonymous runs still get
 * the built-in server.
 */
export async function loadMcpConnections(repo: McpRepository, userId: string | null): Promise<McpServerConnection[]> {
  const builtin = builtinMcpConnection();
  if (!userId) {
    return [builtin];
  }
  return [builtin, ...(await loadUserMcpConnections(repo, userId))];
}
