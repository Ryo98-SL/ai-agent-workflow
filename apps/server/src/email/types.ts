import type { ApiErrorCode, EmailCapabilityResponse } from "@ai-agent-workflow/api-contracts";

export type EmailMessage = { to: string; subject: string; body: string };

export type EmailSender = (email: EmailMessage) => Promise<{ id?: string }>;

export type EmailDeliveryIdentity = {
  userId: string | null;
  idempotencyKey: string;
};

export type EmailDelivery = (
  email: EmailMessage,
  identity: EmailDeliveryIdentity,
) => Promise<{ id?: string; duplicate?: boolean }>;

export type EmailAttemptStatus = "reserved" | "sent" | "failed";

export type EmailAttemptRecord = {
  id: string;
  userId: string;
  idempotencyHash: string;
  recipient: string;
  status: EmailAttemptStatus;
  providerMessageId?: string;
  failureSummary?: string;
  createdAt: Date;
  completedAt?: Date;
};

export type EmailQuotaSnapshot = {
  userMinute: number;
  userDay: number;
  platformDay: number;
  platformMonth: number;
  resets: {
    userMinute: Date;
    day: Date;
    month: Date;
  };
};

export type EmailQuotaLimitCode =
  | "email_user_minute_limit"
  | "email_user_daily_limit"
  | "email_platform_daily_limit"
  | "email_platform_monthly_limit";

export type EmailReserveResult =
  | { kind: "reserved"; attempt: EmailAttemptRecord }
  | { kind: "existing"; attempt: EmailAttemptRecord }
  | { kind: "limited"; code: EmailQuotaLimitCode; resetAt: Date };

export type EmailAttemptRepository = {
  reserve(args: {
    userId: string;
    idempotencyHash: string;
    recipient: string;
    now?: Date;
  }): Promise<EmailReserveResult>;
  markSent(id: string, providerMessageId?: string): Promise<void>;
  markFailed(id: string, failureSummary: string): Promise<void>;
  getQuotaSnapshot(userId: string | null, now?: Date): Promise<EmailQuotaSnapshot>;
};

export type EmailDeliveryService = {
  configured: boolean;
  send: EmailDelivery;
  capability(userId: string | null, now?: Date): Promise<EmailCapabilityResponse>;
};

export class EmailDeliveryError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}
