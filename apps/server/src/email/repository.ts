import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import {
  EMAIL_PLATFORM_DAILY_LIMIT,
  EMAIL_PLATFORM_MONTHLY_LIMIT,
  EMAIL_USER_DAILY_LIMIT,
  EMAIL_USER_MINUTE_LIMIT,
  emailQuotaWindows,
} from "./limits";
import type {
  EmailAttemptRecord,
  EmailAttemptRepository,
  EmailAttemptStatus,
  EmailQuotaSnapshot,
  EmailReserveResult,
} from "./types";

type EmailAttemptRow = {
  id: string;
  userId: string;
  idempotencyHash: string;
  recipient: string;
  status: string;
  providerMessageId: string | null;
  failureSummary: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

function toRecord(row: EmailAttemptRow): EmailAttemptRecord {
  return {
    id: row.id,
    userId: row.userId,
    idempotencyHash: row.idempotencyHash,
    recipient: row.recipient,
    status: row.status as EmailAttemptStatus,
    providerMessageId: row.providerMessageId ?? undefined,
    failureSummary: row.failureSummary ?? undefined,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
  };
}

async function retrySerializable<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Email quota transaction could not be completed.");
}

export function createPrismaEmailAttemptRepository(): EmailAttemptRepository {
  return {
    async reserve({ userId, idempotencyHash, recipient, now = new Date() }) {
      try {
        return await retrySerializable(() =>
          prisma.$transaction(
            async (tx): Promise<EmailReserveResult> => {
              const existing = await tx.emailSendAttempt.findUnique({ where: { idempotencyHash } });
              if (existing) {
                return { kind: "existing", attempt: toRecord(existing) };
              }

              const windows = emailQuotaWindows(now);
              const [userMinute, userDay, platformDay, platformMonth] = await Promise.all([
                tx.emailSendAttempt.count({ where: { userId, createdAt: { gte: windows.minuteStart } } }),
                tx.emailSendAttempt.count({ where: { userId, createdAt: { gte: windows.dayStart } } }),
                tx.emailSendAttempt.count({ where: { createdAt: { gte: windows.dayStart } } }),
                tx.emailSendAttempt.count({ where: { createdAt: { gte: windows.monthStart } } }),
              ]);

              if (userMinute >= EMAIL_USER_MINUTE_LIMIT) {
                return { kind: "limited", code: "email_user_minute_limit", resetAt: windows.resets.userMinute };
              }
              if (userDay >= EMAIL_USER_DAILY_LIMIT) {
                return { kind: "limited", code: "email_user_daily_limit", resetAt: windows.resets.day };
              }
              if (platformDay >= EMAIL_PLATFORM_DAILY_LIMIT) {
                return { kind: "limited", code: "email_platform_daily_limit", resetAt: windows.resets.day };
              }
              if (platformMonth >= EMAIL_PLATFORM_MONTHLY_LIMIT) {
                return { kind: "limited", code: "email_platform_monthly_limit", resetAt: windows.resets.month };
              }

              const created = await tx.emailSendAttempt.create({
                data: { userId, idempotencyHash, recipient, status: "reserved", createdAt: now },
              });
              return { kind: "reserved", attempt: toRecord(created) };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          ),
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const existing = await prisma.emailSendAttempt.findUnique({ where: { idempotencyHash } });
          if (existing) return { kind: "existing", attempt: toRecord(existing) };
        }
        throw error;
      }
    },

    async markSent(id, providerMessageId) {
      await prisma.emailSendAttempt.update({
        where: { id },
        data: { status: "sent", providerMessageId, completedAt: new Date() },
      });
    },

    async markFailed(id, failureSummary) {
      await prisma.emailSendAttempt.update({
        where: { id },
        data: { status: "failed", failureSummary, completedAt: new Date() },
      });
    },

    async getQuotaSnapshot(userId, now = new Date()): Promise<EmailQuotaSnapshot> {
      const windows = emailQuotaWindows(now);
      const [userMinute, userDay, platformDay, platformMonth] = await Promise.all([
        userId
          ? prisma.emailSendAttempt.count({ where: { userId, createdAt: { gte: windows.minuteStart } } })
          : Promise.resolve(0),
        userId
          ? prisma.emailSendAttempt.count({ where: { userId, createdAt: { gte: windows.dayStart } } })
          : Promise.resolve(0),
        prisma.emailSendAttempt.count({ where: { createdAt: { gte: windows.dayStart } } }),
        prisma.emailSendAttempt.count({ where: { createdAt: { gte: windows.monthStart } } }),
      ]);
      return { userMinute, userDay, platformDay, platformMonth, resets: windows.resets };
    },
  };
}

export function createInMemoryEmailAttemptRepository(seed: EmailAttemptRecord[] = []): EmailAttemptRepository {
  const rows = new Map(seed.map((row) => [row.idempotencyHash, { ...row }]));
  let counter = seed.length;

  const snapshot = (userId: string | null, now: Date): EmailQuotaSnapshot => {
    const windows = emailQuotaWindows(now);
    const attempts = [...rows.values()];
    return {
      userMinute: userId
        ? attempts.filter((row) => row.userId === userId && row.createdAt >= windows.minuteStart).length
        : 0,
      userDay: userId
        ? attempts.filter((row) => row.userId === userId && row.createdAt >= windows.dayStart).length
        : 0,
      platformDay: attempts.filter((row) => row.createdAt >= windows.dayStart).length,
      platformMonth: attempts.filter((row) => row.createdAt >= windows.monthStart).length,
      resets: windows.resets,
    };
  };

  return {
    async reserve({ userId, idempotencyHash, recipient, now = new Date() }) {
      const existing = rows.get(idempotencyHash);
      if (existing) return { kind: "existing", attempt: { ...existing } };
      const usage = snapshot(userId, now);
      if (usage.userMinute >= EMAIL_USER_MINUTE_LIMIT) {
        return { kind: "limited", code: "email_user_minute_limit", resetAt: usage.resets.userMinute };
      }
      if (usage.userDay >= EMAIL_USER_DAILY_LIMIT) {
        return { kind: "limited", code: "email_user_daily_limit", resetAt: usage.resets.day };
      }
      if (usage.platformDay >= EMAIL_PLATFORM_DAILY_LIMIT) {
        return { kind: "limited", code: "email_platform_daily_limit", resetAt: usage.resets.day };
      }
      if (usage.platformMonth >= EMAIL_PLATFORM_MONTHLY_LIMIT) {
        return { kind: "limited", code: "email_platform_monthly_limit", resetAt: usage.resets.month };
      }
      const attempt: EmailAttemptRecord = {
        id: `email-attempt-${++counter}`,
        userId,
        idempotencyHash,
        recipient,
        status: "reserved",
        createdAt: now,
      };
      rows.set(idempotencyHash, attempt);
      return { kind: "reserved", attempt: { ...attempt } };
    },
    async markSent(id, providerMessageId) {
      const row = [...rows.values()].find((candidate) => candidate.id === id);
      if (row) Object.assign(row, { status: "sent", providerMessageId, completedAt: new Date() });
    },
    async markFailed(id, failureSummary) {
      const row = [...rows.values()].find((candidate) => candidate.id === id);
      if (row) Object.assign(row, { status: "failed", failureSummary, completedAt: new Date() });
    },
    async getQuotaSnapshot(userId, now = new Date()) {
      return snapshot(userId, now);
    },
  };
}
