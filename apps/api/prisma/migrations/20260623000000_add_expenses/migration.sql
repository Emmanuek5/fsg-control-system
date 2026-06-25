-- Cross-zone expense ledger (feed, fuel, utilities, ...).
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "subsidiaryId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expenses_subsidiaryId_idx" ON "expenses"("subsidiaryId");
CREATE INDEX "expenses_incurredAt_idx" ON "expenses"("incurredAt");
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
