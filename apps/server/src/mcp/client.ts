import { jsonSchemaToParamSpec, type ToolDescriptor } from "@ai-agent-workflow/workflow-domain";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { DynamicStructuredTool } from "@langchain/core/tools";

/**
 * MCP transport + snapshot layer (ADR 0004). MCP is HTTP-only (Streamable HTTP
 * with SSE fallback) via `@langchain/mcp-adapters` `MultiServerMCPClient`. This
 * module connects to per-user servers, snapshots their tools into cached
 * `ToolDescriptor`s for the registry, and exposes a runtime connector that hands
 * the agent runtime (T3) live LangChain tools. No stdio. No process-global
 * descriptor registry — descriptors are returned to the caller, never injected.
 */

/** Connection inputs for one server, with **decrypted** header values. */
export type McpServerConnection = {
  identifier: string;
  name: string;
  icon: string;
  url: string;
  /** Decrypted auth headers (header name → value). */
  headers: Record<string, string>;
};

/** A tool as returned by the MCP SDK's `listTools()` (name + input JSON Schema). */
export type McpToolListing = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type ConnectMcpToolsResult = {
  /** Live LangChain tools, namespaced `${identifier}__${toolName}` (see below). */
  tools: DynamicStructuredTool[];
  /** Closes every underlying MCP connection. Always call when done. */
  close: () => Promise<void>;
};

/** Default ceiling for a connect/list round-trip before we abort with an error. */
export const DEFAULT_MCP_TIMEOUT_MS = 15_000;

/** Output fields every MCP tool descriptor exposes (text + structured data). */
const MCP_TOOL_OUTPUT_FIELDS: ToolDescriptor["outputFields"] = [
  { name: "text", type: "string", description: "Tool output text" },
  { name: "data", type: "object", description: "Tool output data" },
];

/**
 * Pure converter: one MCP tool listing → a `ToolDescriptor` with
 * `provider:"mcp"`, `providerId:<identifier>`. The input JSON Schema becomes the
 * inspector param-spec via the domain converter (T1). No network — unit-testable
 * with a mock tool list.
 */
export function mcpToolToDescriptor(server: Pick<McpServerConnection, "identifier" | "icon">, tool: McpToolListing): ToolDescriptor {
  return {
    provider: "mcp",
    providerId: server.identifier,
    toolName: tool.name,
    label: tool.name,
    icon: server.icon || "plug",
    category: "mcp",
    ...(tool.description ? { description: tool.description } : {}),
    params: jsonSchemaToParamSpec(tool.inputSchema, { primaryFirst: true }),
    defaultParams: {},
    outputFields: MCP_TOOL_OUTPUT_FIELDS,
  };
}

/** Converts a whole MCP tool list into snapshot descriptors. */
export function mcpToolsToDescriptors(
  server: Pick<McpServerConnection, "identifier" | "icon">,
  tools: McpToolListing[],
): ToolDescriptor[] {
  return tools.map((tool) => mcpToolToDescriptor(server, tool));
}

/** Builds a `MultiServerMCPClient` over the given servers (HTTP transport only). */
function buildMcpClient(servers: McpServerConnection[]): MultiServerMCPClient {
  const mcpServers: Record<string, { url: string; transport: "http"; headers?: Record<string, string> }> = {};
  for (const server of servers) {
    mcpServers[server.identifier] = {
      url: server.url,
      transport: "http",
      ...(Object.keys(server.headers).length > 0 ? { headers: server.headers } : {}),
    };
  }
  return new MultiServerMCPClient({
    mcpServers,
    // A failed server must surface a clear error, never silently drop tools.
    throwOnLoadError: true,
    onConnectionError: "throw",
    // Namespace tool names by server identifier only: `${identifier}__${toolName}`.
    prefixToolNameWithServerName: true,
    additionalToolNamePrefix: "",
    useStandardContentBlocks: true,
  });
}

/** Builds a single-server `MultiServerMCPClient` (snapshot/inspection). */
export function connectClient(server: McpServerConnection): MultiServerMCPClient {
  return buildMcpClient([server]);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Connects to one server, lists its tools, converts each into a `ToolDescriptor`,
 * then closes the connection. Throws a normalized error on failure (the caller
 * stores it as `lastError`).
 */
export async function snapshotTools(server: McpServerConnection): Promise<ToolDescriptor[]> {
  const client = connectClient(server);
  try {
    const mcpClient = await withTimeout(
      client.getClient(server.identifier),
      DEFAULT_MCP_TIMEOUT_MS,
      `MCP server "${server.identifier}" connection`,
    );
    if (!mcpClient) {
      throw new Error(`MCP server "${server.identifier}" did not return a client.`);
    }
    const listed = await withTimeout(
      mcpClient.listTools(),
      DEFAULT_MCP_TIMEOUT_MS,
      `MCP server "${server.identifier}" listTools`,
    );
    const tools = Array.isArray(listed?.tools) ? (listed.tools as McpToolListing[]) : [];
    return mcpToolsToDescriptors(server, tools);
  } catch (error) {
    throw new Error(`Failed to connect to MCP server "${server.identifier}": ${normalizeError(error)}`);
  } finally {
    await client.close().catch(() => {});
  }
}

/**
 * Runtime connector (T3 consumes this): connects to the given servers and returns
 * the discovered LangChain tools plus a `close()`. Tools are namespaced
 * `${identifier}__${toolName}`. A failed server raises a clear error rather than
 * silently dropping tools; on error the connection is closed before throwing.
 */
export async function connectMcpTools(
  servers: McpServerConnection[],
  opts: { timeoutMs?: number } = {},
): Promise<ConnectMcpToolsResult> {
  if (servers.length === 0) {
    return { tools: [], close: async () => {} };
  }
  const client = buildMcpClient(servers);
  try {
    const tools = await withTimeout(client.getTools(), opts.timeoutMs ?? DEFAULT_MCP_TIMEOUT_MS, "MCP tool discovery");
    return { tools, close: () => client.close().catch(() => {}) };
  } catch (error) {
    await client.close().catch(() => {});
    throw new Error(`Failed to connect MCP tools: ${normalizeError(error)}`);
  }
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "unknown error";
}
