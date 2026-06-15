import {
  ApiErrorResponseSchema,
  CreateMcpServerRequestSchema,
  CreateMcpServerResponseSchema,
  ListMcpServersResponseSchema,
  RefreshMcpServerResponseSchema,
  UpdateMcpServerRequestSchema,
  UpdateMcpServerResponseSchema,
  apiPaths,
  createApiErrorResponse,
  zodIssuesToApiIssues,
  type McpServerHeaderInput,
} from "@ai-agent-workflow/api-contracts";
import type { ToolDescriptor } from "@ai-agent-workflow/workflow-domain";
import { Hono, type Context } from "hono";
import type { z } from "zod";
import { logger } from "../logger";
import { snapshotTools, type McpServerConnection } from "../mcp/client";
import { BUILTIN_MCP_IDENTIFIER, builtinMcpServerDto } from "../mcp/builtin";
import type { McpRepository } from "../mcp/repository";

type McpRoutesOptions = {
  repository: McpRepository;
  resolveUserId: (c: Context) => Promise<string | null>;
  /** Snapshot connector (connect + listTools + convert). Overridable for tests. */
  snapshot?: (server: McpServerConnection) => Promise<ToolDescriptor[]>;
};

async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  return raw.trim() === "" ? {} : JSON.parse(raw);
}

async function parseJsonRequest<T>(
  request: Request,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; status: 400; body: unknown }> {
  try {
    const result = schema.safeParse(await readJsonBody(request));
    if (result.success) {
      return { ok: true, data: result.data };
    }
    return {
      ok: false,
      status: 400,
      body: createApiErrorResponse(
        "validation_error",
        "Request body did not match the API contract.",
        zodIssuesToApiIssues(result.error),
      ),
    };
  } catch (error) {
    return {
      ok: false,
      status: 400,
      body: createApiErrorResponse("bad_request", `Invalid JSON body: ${(error as Error).message}`),
    };
  }
}

function responseFromSchema<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: T): T {
  return schema.parse(value);
}

function unauthorized() {
  return responseFromSchema(
    ApiErrorResponseSchema,
    createApiErrorResponse("unauthorized", "Authentication is required for this resource."),
  );
}

function notFound(message: string) {
  return responseFromSchema(ApiErrorResponseSchema, createApiErrorResponse("not_found", message));
}

function headersToRecord(headers: McpServerHeaderInput[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const header of headers) {
    record[header.name] = header.value;
  }
  return record;
}

/** Runs the snapshot, mapping a connection failure to a stored `lastError`. */
async function trySnapshot(
  snapshot: (server: McpServerConnection) => Promise<ToolDescriptor[]>,
  connection: McpServerConnection,
): Promise<{ tools: ToolDescriptor[]; lastError: string | null; lastConnectedAt: Date | null }> {
  try {
    const tools = await snapshot(connection);
    return { tools, lastError: null, lastConnectedAt: new Date() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "MCP connection failed.";
    logger.warn("mcp.snapshot_failed", { identifier: connection.identifier, message });
    return { tools: [], lastError: message, lastConnectedAt: null };
  }
}

export function createMcpRoutes({ repository, resolveUserId, snapshot = snapshotTools }: McpRoutesOptions) {
  const app = new Hono();

  app.get(apiPaths.mcpServers(), async (c) => {
    // The read-only built-in server is visible to everyone (incl. anonymous); per-user
    // servers are appended only when signed in. Mutating routes below stay auth-gated.
    const userId = await resolveUserId(c);
    const servers = userId ? await repository.list(userId) : [];
    return c.json(
      responseFromSchema(ListMcpServersResponseSchema, { servers: [builtinMcpServerDto(), ...servers] }),
    );
  });

  app.post(apiPaths.mcpServers(), async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const parsed = await parseJsonRequest(c.req.raw, CreateMcpServerRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }

    if (parsed.data.identifier === BUILTIN_MCP_IDENTIFIER) {
      return c.json(
        createApiErrorResponse("conflict", `"${BUILTIN_MCP_IDENTIFIER}" is a reserved built-in identifier.`),
        409,
      );
    }

    const duplicate = await repository.findByIdentifier(userId, parsed.data.identifier);
    if (duplicate) {
      return c.json(createApiErrorResponse("conflict", `An MCP server "${parsed.data.identifier}" already exists.`), 409);
    }

    const headers = headersToRecord(parsed.data.headers);
    const connection: McpServerConnection = {
      identifier: parsed.data.identifier,
      name: parsed.data.name,
      icon: parsed.data.icon ?? "",
      url: parsed.data.url,
      headers,
    };
    const snapshotResult = await trySnapshot(snapshot, connection);

    const server = await repository.create(userId, {
      identifier: parsed.data.identifier,
      name: parsed.data.name,
      icon: parsed.data.icon ?? null,
      url: parsed.data.url,
      headers,
      tools: snapshotResult.tools,
      lastError: snapshotResult.lastError,
      lastConnectedAt: snapshotResult.lastConnectedAt,
    });
    logger.info("mcp.server_created", {
      userId,
      identifier: server.identifier,
      toolCount: server.toolCount,
      lastError: server.lastError,
    });
    return c.json(responseFromSchema(CreateMcpServerResponseSchema, { server }), 201);
  });

  app.patch("/api/mcp-servers/:id", async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const parsed = await parseJsonRequest(c.req.raw, UpdateMcpServerRequestSchema);
    if (!parsed.ok) {
      return c.json(parsed.body, parsed.status);
    }
    const id = c.req.param("id");
    const existing = await repository.getConnection(userId, id);
    if (!existing) {
      return c.json(notFound(`MCP server ${id} was not found.`), 404);
    }

    const headersChanged = parsed.data.headers !== undefined;
    const urlChanged = parsed.data.url !== undefined && parsed.data.url !== existing.url;
    const nextHeaders = headersChanged ? headersToRecord(parsed.data.headers ?? []) : existing.headers;

    // Re-snapshot only when the connection target (url/headers) changes.
    let snapshotPatch: { tools: ToolDescriptor[]; lastError: string | null; lastConnectedAt: Date | null } | null = null;
    if (urlChanged || headersChanged) {
      const connection: McpServerConnection = {
        identifier: existing.identifier,
        name: parsed.data.name ?? existing.name,
        icon: parsed.data.icon ?? existing.icon,
        url: parsed.data.url ?? existing.url,
        headers: nextHeaders,
      };
      snapshotPatch = await trySnapshot(snapshot, connection);
    }

    const server = await repository.update(userId, id, {
      name: parsed.data.name,
      icon: parsed.data.icon,
      url: parsed.data.url,
      headers: headersChanged ? nextHeaders : undefined,
      // On a failed re-snapshot keep the prior tool list but record the error.
      ...(snapshotPatch
        ? {
            ...(snapshotPatch.lastError ? {} : { tools: snapshotPatch.tools }),
            lastError: snapshotPatch.lastError,
            lastConnectedAt: snapshotPatch.lastConnectedAt ?? undefined,
          }
        : {}),
    });
    if (!server) {
      return c.json(notFound(`MCP server ${id} was not found.`), 404);
    }
    return c.json(responseFromSchema(UpdateMcpServerResponseSchema, { server }));
  });

  app.post("/api/mcp-servers/:id/refresh", async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const id = c.req.param("id");
    const connection = await repository.getConnection(userId, id);
    if (!connection) {
      return c.json(notFound(`MCP server ${id} was not found.`), 404);
    }
    const snapshotResult = await trySnapshot(snapshot, connection);
    const server = await repository.update(userId, id, {
      // Keep the prior tools when the refresh fails; only record the error.
      ...(snapshotResult.lastError ? {} : { tools: snapshotResult.tools }),
      lastError: snapshotResult.lastError,
      lastConnectedAt: snapshotResult.lastConnectedAt ?? undefined,
    });
    if (!server) {
      return c.json(notFound(`MCP server ${id} was not found.`), 404);
    }
    logger.info("mcp.server_refreshed", { userId, identifier: server.identifier, toolCount: server.toolCount });
    return c.json(responseFromSchema(RefreshMcpServerResponseSchema, { server }));
  });

  app.delete("/api/mcp-servers/:id", async (c) => {
    const userId = await resolveUserId(c);
    if (!userId) {
      return c.json(unauthorized(), 401);
    }
    const deleted = await repository.delete(userId, c.req.param("id"));
    if (!deleted) {
      return c.json(notFound(`MCP server ${c.req.param("id")} was not found.`), 404);
    }
    return c.body(null, 204);
  });

  return app;
}
