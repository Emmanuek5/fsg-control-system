-- CreateEnum
CREATE TYPE "FarmDispatchType" AS ENUM ('EGGS', 'BIRDS');

-- AlterTable
ALTER TABLE "feed_records" ADD COLUMN     "costPerBag" DOUBLE PRECISION,
ADD COLUMN     "quantityBags" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "farm_dispatches" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "FarmDispatchType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "unitsAdded" INTEGER,
    "inventoryMovementId" TEXT,
    "destination" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "farm_dispatches_inventoryMovementId_key" ON "farm_dispatches"("inventoryMovementId");

-- CreateIndex
CREATE INDEX "farm_dispatches_batchId_idx" ON "farm_dispatches"("batchId");

-- CreateIndex
CREATE INDEX "farm_dispatches_date_idx" ON "farm_dispatches"("date");

-- AddForeignKey
ALTER TABLE "farm_dispatches" ADD CONSTRAINT "farm_dispatches_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "farm_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_dispatches" ADD CONSTRAINT "farm_dispatches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_dispatches" ADD CONSTRAINT "farm_dispatches_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_dispatches" ADD CONSTRAINT "farm_dispatches_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "inventory_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_dispatches" ADD CONSTRAINT "farm_dispatches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
