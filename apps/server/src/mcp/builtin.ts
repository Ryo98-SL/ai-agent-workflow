import type { ZodRawShape } from "zod";
import { z } from "zod";
import type { McpServerDto } from "@ai-agent-workflow/api-contracts";
import type { ToolDescriptor } from "@ai-agent-workflow/workflow-domain";
import { mcpToolsToDescriptors, type McpServerConnection, type McpToolListing } from "./client";

/**
 * The Built-in MCP Server (CONTEXT.md / ADR 0006): a platform-provided, read-only,
 * auth-less example MCP server hosted by this app and usable by everyone — including
 * anonymous visitors — the MCP analogue of the seeded example Knowledge Base.
 *
 * This module is the single source of truth for the built-in tools: their input
 * schemas drive both the live MCP server (`builtin-server.ts`, via `zodShape`) and
 * the authored snapshot descriptors (via `inputSchema`), so the two cannot drift.
 * No database row, no migration — it is a code catalog.
 */

/** Reserved server identifier — create-server validation rejects this (T2). */
export const BUILTIN_MCP_IDENTIFIER = "builtin";
export const BUILTIN_MCP_NAME = "内置示例工具";
export const BUILTIN_MCP_ICON = "plug";

/** Stable timestamps so the built-in DTO is deterministic across requests. */
const BUILTIN_TIMESTAMP = "2026-06-15T00:00:00.000Z";

const DEMO_FACT =
  "云舵工作流支持通过 MCP 协议接入外部工具。这是一个内置示例 MCP 服务器，无需注册或登录即可在 Agent 或 Tool 节点中直接调用。";

/**
 * Safely evaluates a basic arithmetic expression (`+ - * / ( )` and decimals) with a
 * tiny recursive-descent parser — no `eval`/`Function`, no code injection surface.
 */
export function evaluateArithmetic(input: string): number {
  if (!/^[0-9+\-*/().\s]+$/.test(input) || input.trim() === "") {
    throw new Error("Only numbers and + - * / ( ) are allowed.");
  }
  const tokens = input.match(/\d+\.?\d*|[+\-*/()]/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  const parseFactor = (): number => {
    const token = peek();
    if (token === "(") {
      next();
      const value = parseExpr();
      if (next() !== ")") throw new Error("Mismatched parentheses.");
      return value;
    }
    if (token === "-") {
      next();
      return -parseFactor();
    }
    const value = Number(next());
    if (Number.isNaN(value)) throw new Error("Unexpected token in expression.");
    return value;
  };

  const parseTerm = (): number => {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const right = parseFactor();
      if (op === "/" && right === 0) throw new Error("Division by zero.");
      value = op === "*" ? value * right : value / right;
    }
    return value;
  };

  function parseExpr(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error("Unexpected trailing tokens in expression.");
  return result;
}

/** One built-in tool: JSON Schema (for descriptors) + zod shape (for the server) + impl. */
export type BuiltinTool = {
  name: string;
  description: string;
  /** JSON Schema, the McpToolListing shape — feeds the authored descriptors. */
  inputSchema: McpToolListing["inputSchema"];
  /** Equivalent zod shape — feeds `McpServer.registerTool`. */
  zodShape: ZodRawShape;
  /** Pure, read-only implementation returning text output. */
  run: (args: Record<string, unknown>) => string;
};

export const BUILTIN_TOOLS: BuiltinTool[] = [
  {
    name: "echo",
    description: "Echo the provided text back unchanged.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Text to echo back." } },
      required: ["text"],
    },
    zodShape: { text: z.string().describe("Text to echo back.") },
    run: (args) => String(args.text ?? ""),
  },
  {
    name: "calculate",
    description: "Evaluate a basic arithmetic expression, e.g. (2 + 3) * 4.",
    inputSchema: {
      type: "object",
      properties: { expression: { type: "string", description: "Arithmetic expression to evaluate." } },
      required: ["expression"],
    },
    zodShape: { expression: z.string().describe("Arithmetic expression to evaluate.") },
    run: (args) => String(evaluateArithmetic(String(args.expression ?? ""))),
  },
  {
    name: "get_demo_fact",
    description: "Return a short fact about this workflow app's built-in MCP demo.",
    inputSchema: { type: "object", properties: {} },
    zodShape: {},
    run: () => DEMO_FACT,
  },
];

/** Authored snapshot descriptors for the built-in tools (no network). */
export function builtinToolDescriptors(): ToolDescriptor[] {
  return mcpToolsToDescriptors(
    { identifier: BUILTIN_MCP_IDENTIFIER, icon: BUILTIN_MCP_ICON },
    BUILTIN_TOOLS.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })),
  );
}

/** Resolves the built-in server's own URL (self-connection at runtime). */
export function builtinMcpUrl(): string {
  return process.env.BUILTIN_MCP_URL ?? `http://127.0.0.1:${process.env.PORT ?? "8788"}/mcp/builtin`;
}

/** The runtime connection for the built-in server (auth-less — no headers). */
export function builtinMcpConnection(): McpServerConnection {
  return {
    identifier: BUILTIN_MCP_IDENTIFIER,
    name: BUILTIN_MCP_NAME,
    icon: BUILTIN_MCP_ICON,
    url: builtinMcpUrl(),
    headers: {},
  };
}

/**
 * The built-in server's read-only DTO for `GET /mcp-servers` — returned to everyone,
 * including anonymous visitors (T2).
 */
export function builtinMcpServerDto(): McpServerDto {
  const tools = builtinToolDescriptors();
  return {
    id: BUILTIN_MCP_IDENTIFIER,
    identifier: BUILTIN_MCP_IDENTIFIER,
    name: BUILTIN_MCP_NAME,
    icon: BUILTIN_MCP_ICON,
    url: builtinMcpUrl(),
    headerNames: [],
    readOnly: true,
    toolCount: tools.length,
    tools,
    lastConnectedAt: null,
    lastError: null,
    createdAt: BUILTIN_TIMESTAMP,
    updatedAt: BUILTIN_TIMESTAMP,
  };
}
