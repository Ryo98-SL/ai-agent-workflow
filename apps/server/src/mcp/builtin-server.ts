import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { logger } from "../logger";
import { BUILTIN_MCP_NAME, BUILTIN_TOOLS } from "./builtin";

/**
 * Hosts the Built-in MCP Server (ADR 0006) over the Web-Standard Streamable HTTP
 * transport in **stateless** mode (no session store; JSON responses). The runtime
 * still live-connects to this endpoint via `@langchain/mcp-adapters`, so it exercises
 * the real MCP transport rather than calling the tools in-process. The official MCP
 * SDK does the protocol — we never hand-roll it (CLAUDE.md 硬性要求).
 */

/** Builds an `McpServer` with the built-in read-only tools registered. */
export function createBuiltinMcpServer(): McpServer {
  const server = new McpServer({ name: BUILTIN_MCP_NAME, version: "1.0.0" });
  for (const tool of BUILTIN_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.zodShape,
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (args) => {
        try {
          return { content: [{ type: "text" as const, text: tool.run((args ?? {}) as Record<string, unknown>) }] };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Tool execution failed.";
          return { isError: true, content: [{ type: "text" as const, text: message }] };
        }
      },
    );
  }
  return server;
}

/**
 * Hono handler: `app.all("/mcp/builtin", (c) => handleBuiltinMcpRequest(c.req.raw))`.
 * Stateless mode builds a fresh server + transport per request (the SDK's recommended
 * stateless pattern — no shared session state between requests).
 */
export async function handleBuiltinMcpRequest(req: Request): Promise<Response> {
  const server = createBuiltinMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (error) {
    logger.error("builtin_mcp.request_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response(JSON.stringify({ error: "Built-in MCP request failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
