-- Persist every authorized real-email attempt before contacting Resend.
CREATE TABLE "email_send_attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyHash" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "providerMessageId" TEXT,
    "failureSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "email_send_attempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_send_attempt_idempotencyHash_key"
ON "email_send_attempt"("idempotencyHash");

CREATE INDEX "email_send_attempt_createdAt_idx"
ON "email_send_attempt"("createdAt");

CREATE INDEX "email_send_attempt_userId_createdAt_idx"
ON "email_send_attempt"("userId", "createdAt");

ALTER TABLE "email_send_attempt"
ADD CONSTRAINT "email_send_attempt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
