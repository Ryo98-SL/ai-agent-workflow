CREATE TABLE "platform_daily_usage" (
    "day" TEXT NOT NULL,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_daily_usage_pkey" PRIMARY KEY ("day")
);
