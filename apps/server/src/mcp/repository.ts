import type { McpServerDto } from "@ai-agent-workflow/api-contracts";
import type { ToolDescriptor } from "@ai-agent-workflow/workflow-domain";
import { randomUUID } from "node:crypto";
import { decryptSecret, encryptSecret } from "../auth/crypto";
import { prisma } from "../db/prisma";
import type { McpServerConnection } from "./client";

/**
 * Account-level MCP server persistence (ADR 0004), scoped by `userId` and
 * mirroring `knowledge/repository.ts`. Header secrets are encrypted at rest with
 * the shared provider-key crypto and are **never** returned to the client — DTOs
 * surface header NAMES and the cached tool snapshot only. Decrypted header values
 * are exposed solely through `getConnection`, used by snapshot/refresh/execution.
 */

/** One encrypted header value, base64-encoded so it fits a JSON column. */
type StoredEncryptedHeader = {
  ciphertext: string;
  iv: string;
  authTag: string;
  last4: string;
};

/** Persisted header map: header name → encrypted value. */
type StoredHeaders = Record<string, StoredEncryptedHeader>;

/** Create inputs (plaintext headers + a fresh snapshot result). */
export type McpServerWriteInput = {
  identifier: string;
  name: string;
  icon?: string | null;
  url: string;
  /** Plaintext header values — encrypted here before persistence. */
  headers: Record<string, string>;
  tools: ToolDescriptor[];
  lastError: string | null;
  lastConnectedAt: Date | null;
};

/** Patch inputs. Omitted fields are left unchanged; `headers` (when present) replaces all. */
export type McpServerUpdateInput = {
  name?: string;
  icon?: string | null;
  url?: string;
  /** Plaintext header values — when present, replaces ALL stored headers. */
  headers?: Record<string, string>;
  tools?: ToolDescriptor[];
  lastError?: string | null;
  lastConnectedAt?: Date | null;
};

export type McpRepository = {
  list(userId: string): Promise<McpServerDto[]>;
  get(userId: string, id: string): Promise<McpServerDto | null>;
  findByIdentifier(userId: string, identifier: string): Promise<McpServerDto | null>;
  /** Decrypted connection inputs for snapshot/refresh/execution. Null if not owned. */
  getConnection(userId: string, id: string): Promise<McpServerConnection | null>;
  create(userId: string, input: McpServerWriteInput): Promise<McpServerDto>;
  update(userId: string, id: string, patch: McpServerUpdateInput): Promise<McpServerDto | null>;
  delete(userId: string, id: string): Promise<boolean>;
};

function encryptHeaders(headers: Record<string, string>): StoredHeaders {
  const stored: StoredHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    const encrypted = encryptSecret(value);
    stored[name] = {
      ciphertext: Buffer.from(encrypted.ciphertext).toString("base64"),
      iv: Buffer.from(encrypted.iv).toString("base64"),
      authTag: Buffer.from(encrypted.authTag).toString("base64"),
      last4: encrypted.last4,
    };
  }
  return stored;
}

function decryptHeaders(stored: StoredHeaders): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, secret] of Object.entries(stored)) {
    headers[name] = decryptSecret({
      ciphertext: new Uint8Array(Buffer.from(secret.ciphertext, "base64")),
      iv: new Uint8Array(Buffer.from(secret.iv, "base64")),
      authTag: new Uint8Array(Buffer.from(secret.authTag, "base64")),
    });
  }
  return headers;
}

type McpServerRow = {
  id: string;
  identifier: string;
  name: string;
  icon: string | null;
  url: string;
  headersEncrypted: unknown;
  toolsSnapshot: unknown;
  lastConnectedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function storedHeadersOf(row: McpServerRow): StoredHeaders {
  return (row.headersEncrypted && typeof row.headersEncrypted === "object" ? row.headersEncrypted : {}) as StoredHeaders;
}

function toolsOf(row: McpServerRow): ToolDescriptor[] {
  return Array.isArray(row.toolsSnapshot) ? (row.toolsSnapshot as ToolDescriptor[]) : [];
}

function toDto(row: McpServerRow): McpServerDto {
  const tools = toolsOf(row);
  return {
    id: row.id,
    identifier: row.identifier,
    name: row.name,
    icon: row.icon,
    url: row.url,
    headerNames: Object.keys(storedHeadersOf(row)),
    readOnly: false,
    toolCount: tools.length,
    tools,
    lastConnectedAt: row.lastConnectedAt ? row.lastConnectedAt.toISOString() : null,
    lastError: row.lastError ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toConnection(row: McpServerRow): McpServerConnection {
  return {
    identifier: row.identifier,
    name: row.name,
    icon: row.icon ?? "",
    url: row.url,
    headers: decryptHeaders(storedHeadersOf(row)),
  };
}

// Prisma's JSON typings reject our structured descriptors/headers; mirror the
// knowledge repository and treat the client as untyped for JSON writes.
const db = prisma as any;

export function createPrismaMcpRepository(): McpRepository {
  return {
    async list(userId) {
      const rows = (await db.mcpServer.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      })) as McpServerRow[];
      return rows.map(toDto);
    },

    async get(userId, id) {
      const row = (await db.mcpServer.findFirst({ where: { id, userId } })) as McpServerRow | null;
      return row ? toDto(row) : null;
    },

    async findByIdentifier(userId, identifier) {
      const row = (await db.mcpServer.findFirst({ where: { userId, identifier } })) as McpServerRow | null;
      return row ? toDto(row) : null;
    },

    async getConnection(userId, id) {
      const row = (await db.mcpServer.findFirst({ where: { id, userId } })) as McpServerRow | null;
      return row ? toConnection(row) : null;
    },

    async create(userId, input) {
      const row = (await db.mcpServer.create({
        data: {
          userId,
          identifier: input.identifier,
          name: input.name,
          icon: input.icon ?? null,
          url: input.url,
          headersEncrypted: encryptHeaders(input.headers),
          toolsSnapshot: input.tools,
          lastError: input.lastError,
          lastConnectedAt: input.lastConnectedAt,
        },
      })) as McpServerRow;
      return toDto(row);
    },

    async update(userId, id, patch) {
      const existing = (await db.mcpServer.findFirst({ where: { id, userId } })) as McpServerRow | null;
      if (!existing) {
        return null;
      }
      const row = (await db.mcpServer.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
          ...(patch.url !== undefined ? { url: patch.url } : {}),
          ...(patch.headers !== undefined ? { headersEncrypted: encryptHeaders(patch.headers) } : {}),
          ...(patch.tools !== undefined ? { toolsSnapshot: patch.tools } : {}),
          ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
          ...(patch.lastConnectedAt !== undefined ? { lastConnectedAt: patch.lastConnectedAt } : {}),
        },
      })) as McpServerRow;
      return toDto(row);
    },

    async delete(userId, id) {
      const result = await db.mcpServer.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },
  };
}

/** In-memory MCP repository for DB-free tests; same encryption + DTO contract. */
export function createInMemoryMcpRepository(): McpRepository {
  const rows = new Map<string, McpServerRow & { userId: string }>();

  const owned = (userId: string, id: string) => {
    const row = rows.get(id);
    return row && row.userId === userId ? row : null;
  };

  return {
    async list(userId) {
      return [...rows.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(toDto);
    },

    async get(userId, id) {
      const row = owned(userId, id);
      return row ? toDto(row) : null;
    },

    async findByIdentifier(userId, identifier) {
      const row = [...rows.values()].find((item) => item.userId === userId && item.identifier === identifier);
      return row ? toDto(row) : null;
    },

    async getConnection(userId, id) {
      const row = owned(userId, id);
      return row ? toConnection(row) : null;
    },

    async create(userId, input) {
      const now = new Date();
      const row: McpServerRow & { userId: string } = {
        id: `mcp-${randomUUID()}`,
        userId,
        identifier: input.identifier,
        name: input.name,
        icon: input.icon ?? null,
        url: input.url,
        headersEncrypted: encryptHeaders(input.headers),
        toolsSnapshot: input.tools,
        lastConnectedAt: input.lastConnectedAt,
        lastError: input.lastError,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(row.id, row);
      return toDto(row);
    },

    async update(userId, id, patch) {
      const row = owned(userId, id);
      if (!row) {
        return null;
      }
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.icon !== undefined) row.icon = patch.icon ?? null;
      if (patch.url !== undefined) row.url = patch.url;
      if (patch.headers !== undefined) row.headersEncrypted = encryptHeaders(patch.headers);
      if (patch.tools !== undefined) row.toolsSnapshot = patch.tools;
      if (patch.lastError !== undefined) row.lastError = patch.lastError;
      if (patch.lastConnectedAt !== undefined) row.lastConnectedAt = patch.lastConnectedAt;
      row.updatedAt = new Date();
      return toDto(row);
    },

    async delete(userId, id) {
      const row = owned(userId, id);
      if (!row) {
        return false;
      }
      rows.delete(id);
      return true;
    },
  };
}
