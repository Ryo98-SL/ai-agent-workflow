-- CreateTable
CREATE TABLE "mcp_server" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "url" TEXT NOT NULL,
    "headersEncrypted" JSONB NOT NULL,
    "toolsSnapshot" JSONB NOT NULL,
    "lastConnectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_server_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_server_userId_idx" ON "mcp_server"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_server_userId_identifier_key" ON "mcp_server"("userId", "identifier");

-- AddForeignKey
ALTER TABLE "mcp_server" ADD CONSTRAINT "mcp_server_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
