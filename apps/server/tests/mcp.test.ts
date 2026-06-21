import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { McpServerDto } from "@ai-agent-workflow/api-contracts";
import type { ToolDescriptor } from "@ai-agent-workflow/workflow-domain";
import { resetMasterKeyCache } from "../src/auth/crypto";
import {
  connectMcpTools,
  mcpToolsToDescriptors,
  type McpServerConnection,
  type McpToolListing,
} from "../src/mcp/client";
import { createInMemoryMcpRepository, type McpRepository } from "../src/mcp/repository";
import { loadMcpConnections } from "../src/mcp/connections";
import { createMcpRoutes } from "../src/routes/mcp";

const ORIGINAL_KEY = process.env.MASTER_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.MASTER_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  resetMasterKeyCache();
});

afterEach(() => {
  process.env.MASTER_ENCRYPTION_KEY = ORIGINAL_KEY;
  resetMasterKeyCache();
});

// A mock MCP tool list (what `listTools()` returns), used by the fake snapshot.
const MOCK_TOOLS: McpToolListing[] = [
  {
    name: "forecast",
    description: "Weather forecast",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
        days: { type: "integer" },
        units: { type: "string", enum: ["metric", "imperial"] },
      },
      required: ["city"],
    },
  },
  { name: "ping", inputSchema: { type: "object", properties: {} } },
];

function fakeSnapshot(server: McpServerConnection): Promise<ToolDescriptor[]> {
  return Promise.resolve(mcpToolsToDescriptors(server, MOCK_TOOLS));
}

function failingSnapshot(): Promise<ToolDescriptor[]> {
  return Promise.reject(new Error("ECONNREFUSED 127.0.0.1:9"));
}

/** Mounts the MCP routes for a fixed user (or anonymous when userId is null). */
function createApp(options: {
  userId: string | null;
  repository: McpRepository;
  snapshot?: (server: McpServerConnection) => Promise<ToolDescriptor[]>;
}) {
  const app = new Hono();
  app.route(
    "/",
    createMcpRoutes({
      repository: options.repository,
      resolveUserId: async () => options.userId,
      snapshot: options.snapshot ?? fakeSnapshot,
    }),
  );
  return app;
}

async function createServer(
  app: Hono,
  body: Record<string, unknown> = {
    identifier: "weather",
    name: "Weather",
    url: "https://mcp.example.com/mcp",
    headers: [{ name: "Authorization", value: "Bearer secret-token-1234" }],
  },
) {
  return app.request("/api/mcp-servers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("mcpToolToDescriptor (pure converter)", () => {
  it("converts an MCP tool list into provider:'mcp' descriptors via jsonSchemaToParamSpec", () => {
    const descriptors = mcpToolsToDescriptors({ identifier: "weather", icon: "" }, MOCK_TOOLS);
    expect(descriptors).toHaveLength(2);
    const [forecast] = descriptors;
    expect(forecast).toMatchObject({
      provider: "mcp",
      providerId: "weather",
      toolName: "forecast",
      icon: "plug",
      category: "mcp",
      description: "Weather forecast",
    });
    expect(forecast.params.map((p) => [p.name, p.type])).toEqual([
      ["city", "string"],
      ["days", "number"],
      ["units", "select"],
    ]);
    expect(forecast.params[0]).toMatchObject({ required: true, primary: true });
    expect(forecast.outputFields.map((f) => f.name)).toEqual(["text", "data"]);
  });

  it("uses the server icon when provided", () => {
    const [tool] = mcpToolsToDescriptors({ identifier: "s", icon: "globe" }, [MOCK_TOOLS[1]]);
    expect(tool.icon).toBe("globe");
  });
});

describe("MCP routes — auth + identifier validation", () => {
  it("serves the built-in server to anonymous list but gates every mutating route", async () => {
    const app = createApp({ userId: null, repository: createInMemoryMcpRepository() });
    const list = await app.request("/api/mcp-servers");
    expect(list.status).toBe(200);
    const { servers } = (await list.json()) as { servers: McpServerDto[] };
    expect(servers.map((s) => s.identifier)).toEqual(["builtin"]);
    expect(servers[0].readOnly).toBe(true);
    // Mutating routes still require auth.
    expect((await createServer(app)).status).toBe(401);
    expect((await app.request("/api/mcp-servers/x", { method: "PATCH", body: "{}" })).status).toBe(401);
    expect((await app.request("/api/mcp-servers/x/refresh", { method: "POST" })).status).toBe(401);
    expect((await app.request("/api/mcp-servers/x", { method: "DELETE" })).status).toBe(401);
  });

  it("rejects the reserved built-in identifier on create", async () => {
    const app = createApp({ userId: "user-1", repository: createInMemoryMcpRepository() });
    const response = await createServer(app, {
      identifier: "builtin",
      name: "X",
      url: "https://mcp.example.com/mcp",
      headers: [],
    });
    expect(response.status).toBe(409);
  });

  it("rejects an identifier over 24 chars or with invalid characters", async () => {
    const app = createApp({ userId: "user-1", repository: createInMemoryMcpRepository() });
    const tooLong = await createServer(app, {
      identifier: "x".repeat(25),
      name: "X",
      url: "https://mcp.example.com/mcp",
      headers: [],
    });
    expect(tooLong.status).toBe(400);
    const badChars = await createServer(app, {
      identifier: "Bad Name",
      name: "X",
      url: "https://mcp.example.com/mcp",
      headers: [],
    });
    expect(badChars.status).toBe(400);
  });

  it("rejects a duplicate identifier for the same user", async () => {
    const app = createApp({ userId: "user-1", repository: createInMemoryMcpRepository() });
    expect((await createServer(app)).status).toBe(201);
    expect((await createServer(app)).status).toBe(409);
  });

  it("auto-generates a unique slug identifier from the name when omitted", async () => {
    const app = createApp({ userId: "user-1", repository: createInMemoryMcpRepository() });
    const body = { name: "Weather Service", url: "https://mcp.example.com/mcp", headers: [] };

    const first = await createServer(app, body);
    expect(first.status).toBe(201);
    expect(((await first.json()) as { server: McpServerDto }).server.identifier).toBe("weather-service");

    // A second server with the same name gets a numeric suffix instead of a 409.
    const second = await createServer(app, body);
    expect(second.status).toBe(201);
    expect(((await second.json()) as { server: McpServerDto }).server.identifier).toBe("weather-service-2");
  });

  it("falls back to 'mcp' when the name has no slug-able characters", async () => {
    const app = createApp({ userId: "user-1", repository: createInMemoryMcpRepository() });
    const response = await createServer(app, { name: "天气服务", url: "https://mcp.example.com/mcp", headers: [] });
    expect(response.status).toBe(201);
    expect(((await response.json()) as { server: McpServerDto }).server.identifier).toBe("mcp");
  });
});

describe("MCP routes — snapshot + header secrecy", () => {
  it("snapshots tools on create and never serializes header values", async () => {
    const app = createApp({ userId: "user-1", repository: createInMemoryMcpRepository() });
    const response = await createServer(app);
    expect(response.status).toBe(201);
    const { server } = (await response.json()) as { server: McpServerDto };

    expect(server.identifier).toBe("weather");
    expect(server.toolCount).toBe(2);
    expect(server.tools[0].provider).toBe("mcp");
    expect(server.lastError).toBeNull();
    expect(server.lastConnectedAt).not.toBeNull();
    // Header NAMES are surfaced; the secret value never is.
    expect(server.headerNames).toEqual(["Authorization"]);
    const serialized = JSON.stringify(server);
    expect(serialized).not.toContain("Bearer secret-token-1234");
    expect(serialized).not.toContain("secret-token-1234");
  });

  it("decrypts headers only through getConnection (round-trip)", async () => {
    const repository = createInMemoryMcpRepository();
    const app = createApp({ userId: "user-1", repository });
    const { server } = (await (await createServer(app)).json()) as { server: McpServerDto };

    const connection = await repository.getConnection("user-1", server.id);
    expect(connection?.headers).toEqual({ Authorization: "Bearer secret-token-1234" });
    // Other users cannot read the connection.
    expect(await repository.getConnection("user-2", server.id)).toBeNull();
  });

  it("stores lastError on a connection failure without throwing out of create", async () => {
    const app = createApp({ userId: "user-1", repository: createInMemoryMcpRepository(), snapshot: failingSnapshot });
    const response = await createServer(app);
    expect(response.status).toBe(201);
    const { server } = (await response.json()) as { server: McpServerDto };
    expect(server.toolCount).toBe(0);
    expect(server.lastError).toContain("ECONNREFUSED");
    expect(server.lastConnectedAt).toBeNull();
  });
});

describe("MCP routes — lifecycle + auth scoping", () => {
  it("lists/refreshes/updates/deletes scoped to the owner", async () => {
    const repository = createInMemoryMcpRepository();
    const app = createApp({ userId: "user-1", repository });
    const { server } = (await (await createServer(app)).json()) as { server: McpServerDto };

    // List returns the built-in server plus the owner's server with cached tools.
    const list = (await (await app.request("/api/mcp-servers")).json()) as { servers: McpServerDto[] };
    expect(list.servers.map((s) => s.identifier)).toEqual(["builtin", "weather"]);
    const weather = list.servers.find((s) => s.identifier === "weather");
    expect(weather?.tools).toHaveLength(2);
    expect(weather?.readOnly).toBe(false);
    expect(list.servers.find((s) => s.identifier === "builtin")?.readOnly).toBe(true);

    // Refresh re-snapshots and returns the updated record.
    const refreshed = await app.request(`/api/mcp-servers/${server.id}/refresh`, { method: "POST" });
    expect(refreshed.status).toBe(200);

    // Update name without touching headers.
    const patched = await app.request(`/api/mcp-servers/${server.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Weather Pro" }),
    });
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as { server: McpServerDto }).server.name).toBe("Weather Pro");

    // A different user sees none of it and cannot delete it.
    const otherApp = createApp({ userId: "user-2", repository });
    const otherList = (await (await otherApp.request("/api/mcp-servers")).json()) as { servers: McpServerDto[] };
    expect(otherList.servers.map((s) => s.identifier)).toEqual(["builtin"]);
    expect((await otherApp.request(`/api/mcp-servers/${server.id}`, { method: "DELETE" })).status).toBe(404);

    // The owner can delete it.
    expect((await app.request(`/api/mcp-servers/${server.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await app.request(`/api/mcp-servers/${server.id}`, { method: "PATCH", body: "{}" })).status).toBe(404);
  });
});

describe("connectMcpTools (runtime connector)", () => {
  it("returns no tools and a working close for an empty server list", async () => {
    const result = await connectMcpTools([]);
    expect(result.tools).toEqual([]);
    await expect(result.close()).resolves.toBeUndefined();
  });

  it("raises a clear error for an unreachable server (no silent tool drop)", async () => {
    const server: McpServerConnection = {
      identifier: "down",
      name: "Down",
      icon: "",
      url: "http://127.0.0.1:9/mcp",
      headers: {},
    };
    await expect(connectMcpTools([server], { timeoutMs: 2000 })).rejects.toThrow(/MCP tools/);
  });
});

describe("loadMcpConnections (run-time injection — ADR 0006)", () => {
  it("always includes the built-in connection, even for anonymous runs", async () => {
    const connections = await loadMcpConnections(createInMemoryMcpRepository(), null);
    expect(connections.map((c) => c.identifier)).toEqual(["builtin"]);
  });

  it("appends the signed-in user's own servers", async () => {
    const repository = createInMemoryMcpRepository();
    const app = createApp({ userId: "user-1", repository });
    await createServer(app);
    const connections = await loadMcpConnections(repository, "user-1");
    expect(connections.map((c) => c.identifier).sort()).toEqual(["builtin", "weather"]);
  });
});
