CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'NEEDS_INFO', 'CANCELLED');
CREATE TYPE "FinancialRequestType" AS ENUM ('CASH_EXPENSE', 'BANK_TRANSFER', 'AIRTIME', 'DATA_BUNDLE', 'ELECTRICITY_BILL');
CREATE TYPE "PaymentProvider" AS ENUM ('NONE', 'NOMBA');
CREATE TYPE "ProviderStatus" AS ENUM ('NOT_INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED');
CREATE TYPE "ExpensePaymentStatus" AS ENUM ('PAID', 'APPROVED_NOT_PAID', 'PROCESSING', 'FAILED');
CREATE TYPE "StaffDepartment" AS ENUM ('FARM', 'SHOP', 'HR', 'ASSETS', 'CROPS', 'LIVESTOCK', 'FINANCE', 'ADMIN', 'OTHER');
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LEFT');
CREATE TYPE "RequestEntityType" AS ENUM ('STOCK_REQUEST', 'FINANCIAL_REQUEST', 'STAFF', 'GENERAL');
CREATE TYPE "NotificationType" AS ENUM ('REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_DENIED', 'NEEDS_INFO', 'REQUEST_UPDATED', 'PAYMENT_STATUS', 'GENERAL');

ALTER TABLE "expenses" ADD COLUMN "paymentStatus" "ExpensePaymentStatus" NOT NULL DEFAULT 'PAID';

CREATE TABLE "staff" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "jobTitle" TEXT,
  "department" "StaffDepartment" NOT NULL DEFAULT 'OTHER',
  "subsidiaryId" TEXT,
  "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate" TIMESTAMP(3),
  "bankName" TEXT,
  "accountNumber" TEXT,
  "accountName" TEXT,
  "linkedUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_requests" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "subsidiaryId" TEXT,
  "type" "MovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DOUBLE PRECISION,
  "reference" TEXT,
  "note" TEXT,
  "receiptUrl" TEXT,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "decisionNote" TEXT,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "inventoryMovementId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_requests" (
  "id" TEXT NOT NULL,
  "type" "FinancialRequestType" NOT NULL,
  "subsidiaryId" TEXT,
  "department" "StaffDepartment",
  "amount" DOUBLE PRECISION NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "vendor" TEXT,
  "payeeName" TEXT,
  "requestedFor" TIMESTAMP(3),
  "attachmentUrl" TEXT,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "decisionNote" TEXT,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "phoneNumber" TEXT,
  "network" TEXT,
  "dataPlan" TEXT,
  "disco" TEXT,
  "customerId" TEXT,
  "meterType" TEXT,
  "payerName" TEXT,
  "merchantTxRef" TEXT,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'NONE',
  "providerStatus" "ProviderStatus" NOT NULL DEFAULT 'NOT_INITIATED',
  "providerReference" TEXT,
  "providerResponse" JSONB,
  "executedAt" TIMESTAMP(3),
  "executedById" TEXT,
  "expenseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "financial_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "request_comments" (
  "id" TEXT NOT NULL,
  "entityType" "RequestEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "authorId" TEXT,
  "message" TEXT NOT NULL,
  "isInstruction" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "request_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL DEFAULT 'GENERAL',
  "title" TEXT NOT NULL,
  "message" TEXT,
  "entityType" "RequestEntityType" NOT NULL DEFAULT 'GENERAL',
  "entityId" TEXT,
  "href" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_linkedUserId_key" ON "staff"("linkedUserId");
CREATE INDEX "staff_department_idx" ON "staff"("department");
CREATE INDEX "staff_subsidiaryId_idx" ON "staff"("subsidiaryId");
CREATE UNIQUE INDEX "stock_requests_inventoryMovementId_key" ON "stock_requests"("inventoryMovementId");
CREATE INDEX "stock_requests_status_idx" ON "stock_requests"("status");
CREATE INDEX "stock_requests_requestedById_idx" ON "stock_requests"("requestedById");
CREATE INDEX "stock_requests_productId_idx" ON "stock_requests"("productId");
CREATE UNIQUE INDEX "financial_requests_merchantTxRef_key" ON "financial_requests"("merchantTxRef");
CREATE UNIQUE INDEX "financial_requests_expenseId_key" ON "financial_requests"("expenseId");
CREATE INDEX "financial_requests_status_idx" ON "financial_requests"("status");
CREATE INDEX "financial_requests_type_idx" ON "financial_requests"("type");
CREATE INDEX "financial_requests_requestedById_idx" ON "financial_requests"("requestedById");
CREATE INDEX "request_comments_entityType_entityId_idx" ON "request_comments"("entityType", "entityId");
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");
CREATE INDEX "notifications_entityType_entityId_idx" ON "notifications"("entityType", "entityId");

ALTER TABLE "staff" ADD CONSTRAINT "staff_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff" ADD CONSTRAINT "staff_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "inventory_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_requests" ADD CONSTRAINT "financial_requests_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_requests" ADD CONSTRAINT "financial_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_requests" ADD CONSTRAINT "financial_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_requests" ADD CONSTRAINT "financial_requests_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_requests" ADD CONSTRAINT "financial_requests_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
