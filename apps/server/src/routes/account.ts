import {
  CreateCustomModelRequestSchema,
  CreateProviderKeyRequestSchema,
  apiPaths,
  createApiErrorResponse,
  zodIssuesToApiIssues,
  type CustomModelDto,
  type ProviderKeyDto,
} from "@ai-agent-workflow/api-contracts";
import { Hono } from "hono";
import { decryptSecret, encryptSecret } from "../auth/crypto";
import { requireUser, type AuthVariables } from "../auth/middleware";
import { prisma } from "../db/prisma";
import { logger } from "../logger";

async function readJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  return raw.trim() === "" ? {} : JSON.parse(raw);
}

type ProviderKeyRow = {
  provider: string;
  last4: string;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
};

function toProviderKeyDto(row: { id: string; provider: string; label: string; last4: string }): ProviderKeyDto {
  return { id: row.id, provider: row.provider, label: row.label, last4: row.last4, hasKey: true };
}

function toCustomModelDto(row: {
  id: string;
  provider: string;
  model: string;
  baseURL: string | null;
  label: string | null;
  createdAt: Date;
}): CustomModelDto {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    baseURL: row.baseURL,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Loads and decrypts a specific stored key by id (scoped to the owner). Used by
 * the run executor to inject the active key selected in providerKeyPrefs.
 * Returns null when the id is unknown or not owned by the user.
 */
export async function loadDecryptedProviderKeyById(userId: string, id: string): Promise<string | null> {
  const row = (await prisma.providerKey.findFirst({
    where: { id, userId },
  })) as ProviderKeyRow | null;
  if (!row) {
    return null;
  }
  return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag });
}

/**
 * Loads and decrypts a stored provider key for a user, falling back to the most
 * recently created one when no specific key is selected. Returns null when none
 * is stored. Back-compat path for runs without a providerKeyPrefs selection.
 */
export async function loadDecryptedProviderKey(userId: string, provider: string): Promise<string | null> {
  const row = (await prisma.providerKey.findFirst({
    where: { userId, provider },
    orderBy: { createdAt: "desc" },
  })) as ProviderKeyRow | null;
  if (!row) {
    return null;
  }
  return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag });
}

export function createAccountRoutes() {
  // requireUser is applied per-route (not via app.use("*")) so it cannot leak
  // onto sibling routes when this sub-app is mounted at "/".
  const app = new Hono<{ Variables: AuthVariables }>();

  // --- Provider keys -------------------------------------------------------

  app.get(apiPaths.providerKeys(), requireUser, async (c) => {
    const userId = c.get("userId");
    const rows = await prisma.providerKey.findMany({
      where: { userId },
      select: { id: true, provider: true, label: true, last4: true },
      orderBy: [{ provider: "asc" }, { createdAt: "asc" }],
    });
    return c.json({ keys: rows.map(toProviderKeyDto) });
  });

  app.post(apiPaths.providerKeys(), requireUser, async (c) => {
    const userId = c.get("userId");

    const parsed = CreateProviderKeyRequestSchema.safeParse(await readJsonBody(c.req.raw));
    if (!parsed.success) {
      return c.json(
        createApiErrorResponse("validation_error", "Invalid provider key.", zodIssuesToApiIssues(parsed.error)),
        400,
      );
    }

    const { provider, label } = parsed.data;
    const duplicate = await prisma.providerKey.findUnique({
      where: { userId_provider_label: { userId, provider, label } },
    });
    if (duplicate) {
      return c.json(createApiErrorResponse("conflict", "A key with that label already exists for this provider."), 409);
    }

    const encrypted = encryptSecret(parsed.data.apiKey);
    const row = await prisma.providerKey.create({
      data: {
        userId,
        provider,
        label,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        last4: encrypted.last4,
      },
      select: { id: true, provider: true, label: true, last4: true },
    });

    // Never log the key itself — only that one was stored.
    logger.info("provider_key.stored", { userId, provider, keyId: row.id });
    return c.json({ key: toProviderKeyDto(row) }, 201);
  });

  app.delete("/api/provider-keys/:id", requireUser, async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    // deleteMany scoped by userId → non-owned id silently affects 0 rows (no enumeration).
    await prisma.providerKey.deleteMany({ where: { id, userId } });
    return c.body(null, 204);
  });

  // --- Custom models -------------------------------------------------------

  app.get(apiPaths.customModels(), requireUser, async (c) => {
    const userId = c.get("userId");
    const rows = await prisma.customModel.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return c.json({ models: rows.map(toCustomModelDto) });
  });

  app.post(apiPaths.customModels(), requireUser, async (c) => {
    const userId = c.get("userId");
    const parsed = CreateCustomModelRequestSchema.safeParse(await readJsonBody(c.req.raw));
    if (!parsed.success) {
      return c.json(
        createApiErrorResponse("validation_error", "Invalid custom model.", zodIssuesToApiIssues(parsed.error)),
        400,
      );
    }

    const existing = await prisma.customModel.findUnique({
      where: { userId_provider_model: { userId, provider: parsed.data.provider, model: parsed.data.model } },
    });
    if (existing) {
      return c.json(createApiErrorResponse("conflict", "That model already exists."), 409);
    }

    const row = await prisma.customModel.create({
      data: {
        userId,
        provider: parsed.data.provider,
        model: parsed.data.model,
        baseURL: parsed.data.baseURL ?? null,
        label: parsed.data.label ?? null,
      },
    });
    return c.json({ model: toCustomModelDto(row) }, 201);
  });

  app.delete("/api/custom-models/:id", requireUser, async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    // deleteMany scoped by userId → non-owned id silently affects 0 rows (no enumeration).
    await prisma.customModel.deleteMany({ where: { id, userId } });
    return c.body(null, 204);
  });

  return app;
}
