-- Add a stable dedupe key for auto-generated alerts.
ALTER TABLE "alerts" ADD COLUMN "sourceKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "alerts_sourceKey_key" ON "alerts"("sourceKey");
