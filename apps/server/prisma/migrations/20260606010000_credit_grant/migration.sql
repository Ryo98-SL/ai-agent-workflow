-- One auto-approved credit grant per user (token balance metered at run time).
CREATE TABLE "credit_grant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "grantedTokens" INTEGER NOT NULL,
    "balanceTokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_grant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_grant_userId_key" ON "credit_grant"("userId");

ALTER TABLE "credit_grant" ADD CONSTRAINT "credit_grant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
