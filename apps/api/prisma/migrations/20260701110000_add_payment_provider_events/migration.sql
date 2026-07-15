CREATE TYPE "WebhookVerificationStatus" AS ENUM ('VERIFIED', 'FAILED', 'SKIPPED');

CREATE TABLE "payment_provider_events" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'NOMBA',
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "signature" TEXT,
  "signatureAlgorithm" TEXT,
  "signatureVersion" TEXT,
  "providerTimestamp" TIMESTAMP(3),
  "verificationStatus" "WebhookVerificationStatus" NOT NULL DEFAULT 'SKIPPED',
  "payload" JSONB NOT NULL,
  "merchantTxRef" TEXT,
  "providerReference" TEXT,
  "financialRequestId" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_provider_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_provider_events_provider_eventId_key" ON "payment_provider_events"("provider", "eventId");
CREATE INDEX "payment_provider_events_eventType_idx" ON "payment_provider_events"("eventType");
CREATE INDEX "payment_provider_events_merchantTxRef_idx" ON "payment_provider_events"("merchantTxRef");
CREATE INDEX "payment_provider_events_providerReference_idx" ON "payment_provider_events"("providerReference");

ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_financialRequestId_fkey" FOREIGN KEY ("financialRequestId") REFERENCES "financial_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
