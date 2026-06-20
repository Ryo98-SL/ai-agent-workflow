import { apiPaths, createApiErrorResponse, type CreditStatusDto } from "@ai-agent-workflow/api-contracts";
import { Hono } from "hono";
import { decryptSecret, encryptSecret } from "../auth/crypto";
import { requireUser, type AuthVariables } from "../auth/middleware";
import { getCreditsProvider, getDailyOutputTokenLimit, listConfiguredCreditProviders } from "../config";
import { prisma } from "../db/prisma";
import { logger } from "../logger";

/**
 * Tokens granted when a user first applies for AI credits. Metered 1:1 against
 * the summed input + output tokens of runs that use the "credits" usage
 * priority. Kept as a simple constant until real billing lands.
 */
export const CREDIT_INITIAL_TOKENS = 100_000;

/** UTC day key (YYYY-MM-DD) used to bucket the global daily usage row. */
function dailyUsageKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Output tokens already funded by AI credits across all users today. */
export async function getDailyOutputUsage(): Promise<number> {
  const row = await prisma.platformDailyUsage.findUnique({
    where: { day: dailyUsageKey() },
    select: { outputTokens: true },
  });
  return row?.outputTokens ?? 0;
}

/** Remaining global output-token budget for today (floored at zero). */
export async function getRemainingDailyOutput(): Promise<number> {
  return Math.max(0, getDailyOutputTokenLimit() - (await getDailyOutputUsage()));
}

/** Add a finished credits run's output tokens to today's global meter. */
export async function recordDailyOutputUsage(outputTokens: number): Promise<void> {
  if (outputTokens <= 0) {
    return;
  }
  const day = dailyUsageKey();
  await prisma.platformDailyUsage.upsert({
    where: { day },
    create: { day, outputTokens },
    update: { outputTokens: { increment: outputTokens } },
  });
  logger.info("credits.daily_output_recorded", { day, outputTokens });
}

/**
 * Providers the platform can fund with AI credits right now: the supported set
 * intersected with what env has actually configured a key for.
 */
export function listCreditProviders(): string[] {
  return listConfiguredCreditProviders().filter((provider) => SUPPORTED_PLATFORM_CREDIT_PROVIDERS.has(provider));
}

type CreditGrantRow = { status: string; grantedTokens: number; balanceTokens: number };
export type PlatformCreditsProvider = { apiKey: string; baseURL: string };
type PlatformProviderKeyRow = {
  provider: string;
  baseURL: string;
  enabled: boolean;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
};

const SUPPORTED_PLATFORM_CREDIT_PROVIDERS = new Set(["deepseek"]);

function toCreditStatusDto(row: CreditGrantRow | null): CreditStatusDto {
  if (!row) {
    return { status: "none" };
  }
  return {
    status: "approved",
    grantedTokens: row.grantedTokens,
    balanceTokens: row.balanceTokens,
  };
}

/** Remaining credit balance for a user, or null when they have no grant. */
export async function loadCreditBalance(userId: string): Promise<number | null> {
  const row = await prisma.creditGrant.findUnique({
    where: { userId },
    select: { balanceTokens: true },
  });
  return row ? row.balanceTokens : null;
}

/** Decrement a user's credit balance by the consumed tokens, flooring at zero. */
export async function consumeCredits(userId: string, tokens: number): Promise<void> {
  if (tokens <= 0) {
    return;
  }
  const row = await prisma.creditGrant.findUnique({ where: { userId }, select: { balanceTokens: true } });
  if (!row) {
    return;
  }
  const balanceTokens = Math.max(0, row.balanceTokens - tokens);
  await prisma.creditGrant.update({ where: { userId }, data: { balanceTokens } });
  logger.info("credits.consumed", { userId, tokens, balanceTokens });
}

/**
 * Platform credentials backing AI credits. Only DeepSeek is enabled for the
 * MVP. The key is stored encrypted in DB; env is only used to bootstrap a
 * missing row during local/dev deployment.
 */
export async function loadPlatformCreditsProvider(provider: string): Promise<PlatformCreditsProvider | null> {
  if (!SUPPORTED_PLATFORM_CREDIT_PROVIDERS.has(provider)) {
    return null;
  }

  const row = (await prisma.platformProviderKey.findUnique({
    where: { provider },
  })) as PlatformProviderKeyRow | null;
  if (row) {
    if (!row.enabled) {
      return null;
    }
    return {
      apiKey: decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag }),
      baseURL: row.baseURL,
    };
  }

  return bootstrapPlatformCreditsProvider(provider);
}

async function bootstrapPlatformCreditsProvider(provider: string): Promise<PlatformCreditsProvider | null> {
  const configured = getCreditsProvider(provider);
  if (!configured) {
    return null;
  }

  const encrypted = encryptSecret(configured.apiKey);
  await prisma.platformProviderKey.upsert({
    where: { provider },
    create: {
      provider,
      baseURL: configured.baseURL,
      enabled: true,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      last4: encrypted.last4,
    },
    update: {},
  });
  logger.info("credits.platform_key_bootstrapped", { provider, baseURL: configured.baseURL });
  return configured;
}

export function createCreditRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();

  // Public, non-sensitive: which providers the platform funds with AI credits.
  // The UI reads this to only offer the "AI Credits" option where it can work.
  app.get(apiPaths.creditProviders(), (c) => {
    return c.json({ providers: listCreditProviders() });
  });

  app.get(apiPaths.credits(), requireUser, async (c) => {
    const userId = c.get("userId");
    const row = await prisma.creditGrant.findUnique({
      where: { userId },
      select: { status: true, grantedTokens: true, balanceTokens: true },
    });
    return c.json(toCreditStatusDto(row));
  });

  app.post(apiPaths.creditsApply(), requireUser, async (c) => {
    const userId = c.get("userId");

    const existing = await prisma.creditGrant.findUnique({ where: { userId } });
    if (existing) {
      return c.json(createApiErrorResponse("conflict", "AI credits have already been granted for this account."), 409);
    }

    // Auto-approved: no manual review. One grant per user (enforced by the
    // unique userId column); the application itself is the durable record.
    const row = await prisma.creditGrant.create({
      data: {
        userId,
        status: "approved",
        grantedTokens: CREDIT_INITIAL_TOKENS,
        balanceTokens: CREDIT_INITIAL_TOKENS,
      },
      select: { status: true, grantedTokens: true, balanceTokens: true },
    });
    logger.info("credits.granted", { userId, grantedTokens: row.grantedTokens });
    return c.json(toCreditStatusDto(row), 201);
  });

  return app;
}
