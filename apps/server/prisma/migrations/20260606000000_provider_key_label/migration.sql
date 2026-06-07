-- Add label column, backfilling existing rows with a default label so the
-- NOT NULL constraint holds, then drop the column default to match the schema.
ALTER TABLE "provider_key" ADD COLUMN "label" TEXT NOT NULL DEFAULT 'Default';
ALTER TABLE "provider_key" ALTER COLUMN "label" DROP DEFAULT;

-- Swap the per-provider uniqueness for per-(provider,label) uniqueness so a
-- provider can hold multiple labeled keys.
DROP INDEX "provider_key_userId_provider_key";
CREATE UNIQUE INDEX "provider_key_userId_provider_label_key" ON "provider_key"("userId", "provider", "label");
