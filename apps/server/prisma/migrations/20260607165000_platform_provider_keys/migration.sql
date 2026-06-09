CREATE TABLE "platform_provider_key" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "baseURL" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "last4" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_provider_key_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_provider_key_provider_key" ON "platform_provider_key"("provider");
