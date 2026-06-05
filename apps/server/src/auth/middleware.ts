import { createApiErrorResponse } from "@ai-agent-workflow/api-contracts";
import type { Context, MiddlewareHandler } from "hono";
import { auth } from "./auth";

export type AuthVariables = {
  userId: string;
};

/**
 * Resolves the Better Auth session and returns the userId, or null when the
 * request is unauthenticated. Used by both the hard `requireUser` gate and by
 * endpoints that have an anonymous fallback.
 */
export async function resolveUserId(c: Context): Promise<string | null> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user?.id ?? null;
}

/** Hard auth gate: 401 when no valid session. Sets `userId` on the context. */
export const requireUser: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const userId = await resolveUserId(c);
  if (!userId) {
    return c.json(
      createApiErrorResponse("unauthorized", "Authentication is required for this resource."),
      401,
    );
  }

  c.set("userId", userId);
  await next();
};
