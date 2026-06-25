import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  EMAIL_PLATFORM_DAILY_LIMIT,
  EMAIL_PLATFORM_MONTHLY_LIMIT,
  EMAIL_USER_DAILY_LIMIT,
  EMAIL_USER_MINUTE_LIMIT,
} from "../src/email/limits";
import { createInMemoryEmailAttemptRepository } from "../src/email/repository";
import { createEmailDeliveryService } from "../src/email/service";
import type { EmailAttemptRecord, EmailAttemptRepository } from "../src/email/types";
import { createEmailRoutes } from "../src/routes/email";

function attempt(index: number, args: Partial<EmailAttemptRecord> = {}): EmailAttemptRecord {
  return {
    id: `attempt-${index}`,
    userId: "user-1",
    idempotencyHash: `hash-${index}`,
    recipient: "user@example.com",
    status: "sent",
    createdAt: new Date("2026-06-24T12:00:30.000Z"),
    ...args,
  };
}

describe("safe email delivery", () => {
  it("rejects anonymous real sends before reserving quota or calling the provider", async () => {
    const repository = createInMemoryEmailAttemptRepository();
    const reserve = vi.spyOn(repository, "reserve");
    const sender = vi.fn(async () => ({ id: "email-1" }));
    const service = createEmailDeliveryService({ repository, sender });

    await expect(
      service.send(
        { to: "user@example.com", subject: "Hello", body: "Body" },
        { userId: null, idempotencyKey: "run:tool" },
      ),
    ).rejects.toMatchObject({ code: "email_auth_required" });
    expect(reserve).not.toHaveBeenCalled();
    expect(sender).not.toHaveBeenCalled();
  });

  it("reserves once and suppresses duplicate provider calls", async () => {
    const sender = vi.fn(async () => ({ id: "email-1" }));
    const service = createEmailDeliveryService({
      repository: createInMemoryEmailAttemptRepository(),
      sender,
    });
    const message = { to: "user@example.com", subject: "Hello", body: "Body" };
    const identity = { userId: "user-1", idempotencyKey: "run-1:tool:email-1" };

    await expect(service.send(message, identity)).resolves.toEqual({ id: "email-1" });
    await expect(service.send(message, identity)).resolves.toEqual({ id: "email-1", duplicate: true });
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("consumes failed attempts and never retries them automatically", async () => {
    const sender = vi.fn(async () => {
      throw new Error("provider timeout");
    });
    const service = createEmailDeliveryService({
      repository: createInMemoryEmailAttemptRepository(),
      sender,
    });
    const message = { to: "user@example.com", subject: "Hello", body: "Body" };
    const identity = { userId: "user-1", idempotencyKey: "run-2:tool:email-1" };

    await expect(service.send(message, identity)).rejects.toMatchObject({ code: "email_provider_failed" });
    await expect(service.send(message, identity)).rejects.toMatchObject({ code: "email_provider_failed" });
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("fails closed when persistent quota protection is unavailable", async () => {
    const repository: EmailAttemptRepository = {
      reserve: async () => {
        throw new Error("database unavailable");
      },
      markSent: async () => {},
      markFailed: async () => {},
      getQuotaSnapshot: async () => {
        throw new Error("database unavailable");
      },
    };
    const sender = vi.fn(async () => ({ id: "email-1" }));
    const service = createEmailDeliveryService({ repository, sender });

    await expect(
      service.send(
        { to: "user@example.com", subject: "Hello", body: "Body" },
        { userId: "user-1", idempotencyKey: "run-3:tool:email-1" },
      ),
    ).rejects.toMatchObject({ code: "email_unavailable" });
    expect(sender).not.toHaveBeenCalled();

    await expect(service.capability("user-1")).resolves.toMatchObject({
      email: { available: false, reason: "quota_unavailable" },
    });
  });

  it("enforces the user rolling-minute limit", async () => {
    const now = new Date("2026-06-24T12:01:00.000Z");
    const repository = createInMemoryEmailAttemptRepository(
      Array.from({ length: EMAIL_USER_MINUTE_LIMIT }, (_, index) => attempt(index)),
    );
    await expect(
      repository.reserve({
        userId: "user-1",
        idempotencyHash: "next",
        recipient: "user@example.com",
        now,
      }),
    ).resolves.toMatchObject({ kind: "limited", code: "email_user_minute_limit" });
  });

  it("enforces the user UTC-day limit before the platform limit", async () => {
    const now = new Date("2026-06-24T12:01:00.000Z");
    const repository = createInMemoryEmailAttemptRepository(
      Array.from({ length: EMAIL_USER_DAILY_LIMIT }, (_, index) =>
        attempt(index, { createdAt: new Date("2026-06-24T01:00:00.000Z") }),
      ),
    );
    await expect(
      repository.reserve({
        userId: "user-1",
        idempotencyHash: "day-next",
        recipient: "user@example.com",
        now,
      }),
    ).resolves.toMatchObject({ kind: "limited", code: "email_user_daily_limit" });
  });

  it("resets UTC day and month buckets at their boundaries", async () => {
    const repository = createInMemoryEmailAttemptRepository([
      attempt(1, { createdAt: new Date("2026-05-31T23:59:59.999Z") }),
      attempt(2, { createdAt: new Date("2026-06-23T23:59:59.999Z") }),
    ]);
    await expect(
      repository.getQuotaSnapshot("user-1", new Date("2026-06-24T00:00:00.000Z")),
    ).resolves.toMatchObject({ userDay: 0, platformDay: 0, platformMonth: 1 });
  });

  it("enforces platform day and month safety ceilings", async () => {
    const now = new Date("2026-06-24T12:01:00.000Z");
    const dailyRepository = createInMemoryEmailAttemptRepository(
      Array.from({ length: EMAIL_PLATFORM_DAILY_LIMIT }, (_, index) =>
        attempt(index, { userId: `user-${index}` }),
      ),
    );
    await expect(
      dailyRepository.reserve({
        userId: "new-user",
        idempotencyHash: "daily-next",
        recipient: "user@example.com",
        now,
      }),
    ).resolves.toMatchObject({ kind: "limited", code: "email_platform_daily_limit" });

    const monthlyRepository = createInMemoryEmailAttemptRepository(
      Array.from({ length: EMAIL_PLATFORM_MONTHLY_LIMIT }, (_, index) =>
        attempt(index, {
          userId: `user-${index}`,
          createdAt: new Date(`2026-06-${String((index % 23) + 1).padStart(2, "0")}T01:00:00.000Z`),
        }),
      ),
    );
    await expect(
      monthlyRepository.reserve({
        userId: "new-user",
        idempotencyHash: "monthly-next",
        recipient: "user@example.com",
        now,
      }),
    ).resolves.toMatchObject({ kind: "limited", code: "email_platform_monthly_limit" });
  });

  it("reports public capability without exposing provider secrets", async () => {
    const service = createEmailDeliveryService({
      repository: createInMemoryEmailAttemptRepository(),
      sender: async () => ({ id: "email-1" }),
    });
    const capability = await service.capability(null, new Date("2026-06-24T12:00:00.000Z"));
    expect(capability).toMatchObject({
      email: {
        configured: true,
        eligible: false,
        available: false,
        reason: "sign_in_required",
        limits: { platformDay: 80, platformMonth: 2400 },
      },
    });
    expect(JSON.stringify(capability)).not.toContain("RESEND");
    expect(JSON.stringify(capability)).not.toContain("EMAIL_FROM");
  });

  it("serves the non-sensitive capability endpoint for the current session", async () => {
    const service = createEmailDeliveryService({
      repository: createInMemoryEmailAttemptRepository(),
      sender: async () => ({ id: "email-1" }),
    });
    const app = new Hono();
    app.route("/", createEmailRoutes({ service, resolveUserId: async () => "user-1" }));

    const response = await app.request("/api/email-capability");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      email: { configured: true, eligible: true, available: true },
    });
  });
});
