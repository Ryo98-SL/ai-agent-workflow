import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db/prisma";
import { frontendOrigins } from "../config";
import { seedDefaultWorkflow } from "../workflows/repository";
import { logger } from "../logger";

const cookieDomain = process.env.COOKIE_DOMAIN?.trim() || undefined;

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:8788",
  trustedOrigins: frontendOrigins,
  emailAndPassword: {
    enabled: true,
  },
  // Google is only enabled when credentials are present, so local dev without
  // OAuth setup still boots.
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
  advanced: {
    // Share the session cookie across app.example.com + api.example.com when a
    // parent domain is configured. Left undefined for local dev (same host).
    crossSubDomainCookies: cookieDomain
      ? { enabled: true, domain: cookieDomain }
      : { enabled: false },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Give every new account a starter workflow so the workbench is not
          // empty on first sign-in.
          try {
            await seedDefaultWorkflow(user.id);
          } catch (error) {
            logger.error("user.seed_workflow_failed", {
              userId: user.id,
              message: error instanceof Error ? error.message : "Failed to seed workflow.",
            });
          }
        },
      },
    },
  },
});

export type Auth = typeof auth;
