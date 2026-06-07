import { apiPaths, createApiErrorResponse, type CreditStatusDto } from "@ai-agent-workflow/api-contracts";
import { Hono } from "hono";
import { requireUser, type AuthVariables } from "../auth/middleware";
import { prisma } from "../db/prisma";
import { logger } from "../logger";

/**
 * Tokens granted when a user first applies for AI credits. Metered 1:1 against
 * the summed input + output tokens of runs that use the "credits" usage
 * priority. Kept as a simple constant until real billing lands.
 */
export const CREDIT_INITIAL_TOKENS = 100_000;

type CreditGrantRow = { status: string; grantedTokens: number; balanceTokens: number };

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

export function createCreditRoutes() {
  const app = new Hono<{ Variables: AuthVariables }>();

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
