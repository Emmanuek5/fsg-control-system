-- Bank details for Nomba "resolve-as-you-type" lookups on financial requests and staff.
ALTER TABLE "financial_requests" ADD COLUMN "bankName" TEXT;
ALTER TABLE "financial_requests" ADD COLUMN "bankCode" TEXT;
ALTER TABLE "financial_requests" ADD COLUMN "bankAccountNumber" TEXT;

ALTER TABLE "staff" ADD COLUMN "bankCode" TEXT;
