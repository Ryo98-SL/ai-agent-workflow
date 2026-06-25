import { createHash } from "node:crypto";
import type { EmailCapabilityResponse } from "@ai-agent-workflow/api-contracts";
import {
  EMAIL_PLATFORM_DAILY_LIMIT,
  EMAIL_PLATFORM_MONTHLY_LIMIT,
  EMAIL_USER_DAILY_LIMIT,
  EMAIL_USER_MINUTE_LIMIT,
} from "./limits";
import {
  EmailDeliveryError,
  type EmailAttemptRepository,
  type EmailDeliveryService,
  type EmailQuotaLimitCode,
  type EmailSender,
} from "./types";

function idempotencyHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function limitMessage(code: EmailQuotaLimitCode, resetAt: Date): string {
  const reset = resetAt.toISOString();
  switch (code) {
    case "email_user_minute_limit":
      return `Email send limit reached for this minute. Try again after ${reset}.`;
    case "email_user_daily_limit":
      return `Your daily email send limit has been reached. Try again after ${reset}.`;
    case "email_platform_daily_limit":
      return `The platform's daily safe email limit has been reached. Try again after ${reset}.`;
    case "email_platform_monthly_limit":
      return `The platform's monthly safe email limit has been reached. Try again after ${reset}.`;
  }
}

function safeFailureSummary(error: unknown): string {
  return (error instanceof Error ? error.message : "Email provider failed.").slice(0, 200);
}

export function createEmailDeliveryService(args: {
  repository: EmailAttemptRepository;
  sender?: EmailSender;
}): EmailDeliveryService {
  const { repository, sender } = args;
  return {
    configured: Boolean(sender),

    async send(email, identity) {
      if (!identity.userId) {
        throw new EmailDeliveryError("email_auth_required", "Sign in to send email for real. Dry-run remains available.");
      }
      if (!sender) {
        throw new EmailDeliveryError(
          "email_not_configured",
          "Email sending is not configured on the server. Disable “Send for real” to compose a dry-run instead.",
        );
      }

      let reservation;
      try {
        reservation = await repository.reserve({
          userId: identity.userId,
          idempotencyHash: idempotencyHash(identity.idempotencyKey),
          recipient: email.to,
        });
      } catch {
        throw new EmailDeliveryError(
          "email_unavailable",
          "Email sending is temporarily unavailable because quota protection could not be verified.",
        );
      }

      if (reservation.kind === "limited") {
        throw new EmailDeliveryError(reservation.code, limitMessage(reservation.code, reservation.resetAt));
      }
      if (reservation.kind === "existing") {
        if (reservation.attempt.status === "sent") {
          return { id: reservation.attempt.providerMessageId, duplicate: true };
        }
        if (reservation.attempt.status === "reserved") {
          throw new EmailDeliveryError(
            "email_duplicate_pending",
            "This email delivery is already in progress and will not be sent again.",
          );
        }
        throw new EmailDeliveryError(
          "email_provider_failed",
          reservation.attempt.failureSummary ?? "This email attempt already failed and will not be retried automatically.",
        );
      }

      try {
        const result = await sender(email);
        await repository.markSent(reservation.attempt.id, result.id);
        return result;
      } catch (error) {
        try {
          await repository.markFailed(reservation.attempt.id, safeFailureSummary(error));
        } catch {
          // The reservation already prevents retry. Final-state persistence is best effort.
        }
        throw new EmailDeliveryError("email_provider_failed", "The email provider could not send this message.");
      }
    },

    async capability(userId, now = new Date()): Promise<EmailCapabilityResponse> {
      const base = {
        configured: Boolean(sender),
        eligible: Boolean(userId),
        limits: {
          userMinute: EMAIL_USER_MINUTE_LIMIT,
          userDay: EMAIL_USER_DAILY_LIMIT,
          platformDay: EMAIL_PLATFORM_DAILY_LIMIT,
          platformMonth: EMAIL_PLATFORM_MONTHLY_LIMIT,
        },
      };

      if (!sender) {
        return {
          email: {
            ...base,
            available: false,
            reason: "not_configured",
            remaining: { userMinute: null, userDay: null, platformDay: null, platformMonth: null },
            resets: { userMinute: null, day: null, month: null },
          },
        };
      }

      try {
        const usage = await repository.getQuotaSnapshot(userId, now);
        const remaining = {
          userMinute: userId ? Math.max(0, EMAIL_USER_MINUTE_LIMIT - usage.userMinute) : null,
          userDay: userId ? Math.max(0, EMAIL_USER_DAILY_LIMIT - usage.userDay) : null,
          platformDay: Math.max(0, EMAIL_PLATFORM_DAILY_LIMIT - usage.platformDay),
          platformMonth: Math.max(0, EMAIL_PLATFORM_MONTHLY_LIMIT - usage.platformMonth),
        };
        const quotaAvailable =
          remaining.platformDay > 0 &&
          remaining.platformMonth > 0 &&
          (remaining.userMinute == null || remaining.userMinute > 0) &&
          (remaining.userDay == null || remaining.userDay > 0);
        return {
          email: {
            ...base,
            available: Boolean(userId) && quotaAvailable,
            reason: !userId ? "sign_in_required" : quotaAvailable ? null : "quota_exhausted",
            remaining,
            resets: {
              userMinute: userId ? usage.resets.userMinute.toISOString() : null,
              day: usage.resets.day.toISOString(),
              month: usage.resets.month.toISOString(),
            },
          },
        };
      } catch {
        return {
          email: {
            ...base,
            available: false,
            reason: "quota_unavailable",
            remaining: { userMinute: null, userDay: null, platformDay: null, platformMonth: null },
            resets: { userMinute: null, day: null, month: null },
          },
        };
      }
    },
  };
}
