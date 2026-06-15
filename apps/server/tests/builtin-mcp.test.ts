import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serve, type ServerType } from "@hono/node-server";
import { Hono } from "hono";
import { connectMcpTools, snapshotTools, type McpServerConnection } from "../src/mcp/client";
import { BUILTIN_MCP_IDENTIFIER, builtinToolDescriptors, evaluateArithmetic } from "../src/mcp/builtin";
import { handleBuiltinMcpRequest } from "../src/mcp/builtin-server";

// Spins up the real built-in MCP endpoint on an ephemeral port, then drives it through
// the same @langchain/mcp-adapters connector the runtime uses (no hand-rolled protocol).
let server: ServerType;
let url: string;

beforeAll(async () => {
  const app = new Hono();
  app.all("/mcp/builtin", (c) => handleBuiltinMcpRequest(c.req.raw));
  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 }, (info) => {
      url = `http://127.0.0.1:${info.port}/mcp/builtin`;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

function connection(): McpServerConnection {
  return { identifier: BUILTIN_MCP_IDENTIFIER, name: "内置示例工具", icon: "plug", url, headers: {} };
}

describe("built-in MCP server — real transport over @langchain/mcp-adapters", () => {
  it("lists the read-only demo tools, namespaced by identifier", async () => {
    const { tools, close } = await connectMcpTools([connection()]);
    try {
      expect(tools.map((tool) => tool.name).sort()).toEqual([
        "builtin__calculate",
        "builtin__echo",
        "builtin__get_demo_fact",
      ]);
    } finally {
      await close();
    }
  });

  it("executes tools live (echo + calculate)", async () => {
    const { tools, close } = await connectMcpTools([connection()]);
    try {
      const echo = tools.find((tool) => tool.name === "builtin__echo");
      const calculate = tools.find((tool) => tool.name === "builtin__calculate");
      expect(echo).toBeDefined();
      expect(calculate).toBeDefined();
      expect(String(await echo!.invoke({ text: "hello mcp" }))).toContain("hello mcp");
      expect(String(await calculate!.invoke({ expression: "(2 + 3) * 4" }))).toContain("20");
    } finally {
      await close();
    }
  });

  it("authored descriptors match the live snapshot (names + primary params)", async () => {
    const live = await snapshotTools(connection());
    const authored = builtinToolDescriptors();

    expect(live.map((d) => d.toolName).sort()).toEqual(authored.map((d) => d.toolName).sort());

    const liveByName = new Map(live.map((d) => [d.toolName, d]));
    expect(liveByName.get("echo")?.params.map((p) => p.name)).toEqual(["text"]);
    expect(liveByName.get("calculate")?.params.map((p) => p.name)).toEqual(["expression"]);
    expect(liveByName.get("get_demo_fact")?.params ?? []).toEqual([]);
    // Every built-in descriptor is provider:"mcp" under the reserved identifier.
    for (const descriptor of live) {
      expect(descriptor.provider).toBe("mcp");
      expect(descriptor.providerId).toBe(BUILTIN_MCP_IDENTIFIER);
    }
  });
});

describe("evaluateArithmetic", () => {
  it("evaluates with precedence, parentheses, and decimals", () => {
    expect(evaluateArithmetic("(2 + 3) * 4")).toBe(20);
    expect(evaluateArithmetic("2 + 3 * 4")).toBe(14);
    expect(evaluateArithmetic("10 / 4")).toBe(2.5);
    expect(evaluateArithmetic("-3 + 5")).toBe(2);
  });

  it("rejects non-arithmetic input and division by zero", () => {
    expect(() => evaluateArithmetic("2 + a")).toThrow();
    expect(() => evaluateArithmetic("")).toThrow();
    expect(() => evaluateArithmetic("1 / 0")).toThrow();
    expect(() => evaluateArithmetic("alert(1)")).toThrow();
  });
});
