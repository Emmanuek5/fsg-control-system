-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "subsidiaryId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    "inventoryMovementId" TEXT,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable: sales becomes an order header
ALTER TABLE "sales"
    ADD COLUMN "customerId" TEXT,
    ADD COLUMN "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "logisticsFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "note" TEXT;

ALTER TABLE "sales" RENAME COLUMN "customer" TO "customerName";

-- Existing single-product sales carried no logistics fee, so the whole amount is the subtotal
UPDATE "sales" SET "subtotal" = "totalAmount";

-- Move every existing sale's product line into sale_items
INSERT INTO "sale_items" (
    "id", "saleId", "productId", "productName", "unit", "quantity", "unitPrice", "lineTotal", "inventoryMovementId"
)
SELECT
    md5(random()::text || clock_timestamp()::text || s."id"),
    s."id",
    s."productId",
    COALESCE(p."name", 'Unknown product'),
    COALESCE(p."unit", 'pcs'),
    s."quantity",
    s."unitPrice",
    s."totalAmount",
    s."inventoryMovementId"
FROM "sales" s
LEFT JOIN "products" p ON p."id" = s."productId";

-- Drop the now-migrated single-line columns
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_productId_fkey";
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_inventoryMovementId_fkey";
DROP INDEX IF EXISTS "sales_inventoryMovementId_key";
ALTER TABLE "sales"
    DROP COLUMN "productId",
    DROP COLUMN "quantity",
    DROP COLUMN "unitPrice",
    DROP COLUMN "inventoryMovementId";

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sale_items_inventoryMovementId_key" ON "sale_items"("inventoryMovementId");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");

-- CreateIndex
CREATE INDEX "sales_customerId_idx" ON "sales"("customerId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "inventory_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
