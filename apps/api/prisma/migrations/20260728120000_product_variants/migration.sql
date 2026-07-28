-- Product variants: pack sizes / bottle sizes / loose measures per product.
--
-- Entirely additive. Every existing product gains one "Default" variant that
-- inherits its stock and prices, and every existing sale item, inventory
-- movement and stock request is repointed onto that variant, so no history is
-- lost and no read path breaks before the application code is updated.

-- CreateEnum
CREATE TYPE "StockMode" AS ENUM ('PER_VARIANT', 'POOLED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "stockMode" "StockMode" NOT NULL DEFAULT 'PER_VARIANT';

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "packSize" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");
CREATE UNIQUE INDEX "product_variants_productId_name_key" ON "product_variants"("productId", "name");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one default variant per product. It carries the product's current
-- stock and prices, so a PER_VARIANT rollup of the new table reproduces
-- products.quantityOnHand exactly. The product's SKU moves onto the variant
-- (SKUs identify something sellable, and the variant is now that thing);
-- products.sku is left in place and untouched.
INSERT INTO "product_variants" (
    "id", "productId", "name", "sku", "packSize",
    "unitPrice", "costPrice", "quantityOnHand", "reorderLevel",
    "isDefault", "isActive", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    p."id",
    'Default',
    p."sku",
    1,
    p."unitPrice",
    p."costPrice",
    p."quantityOnHand",
    p."reorderLevel",
    true,
    true,
    NOW(),
    NOW()
FROM "products" p;

-- AlterTable: sale_items
ALTER TABLE "sale_items" ADD COLUMN "variantId" TEXT;
ALTER TABLE "sale_items" ADD COLUMN "variantName" TEXT;

UPDATE "sale_items" si
SET "variantId" = v."id"
FROM "product_variants" v
WHERE v."productId" = si."productId" AND v."isDefault" = true;

CREATE INDEX "sale_items_variantId_idx" ON "sale_items"("variantId");
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: inventory_movements
ALTER TABLE "inventory_movements" ADD COLUMN "variantId" TEXT;

UPDATE "inventory_movements" m
SET "variantId" = v."id"
FROM "product_variants" v
WHERE v."productId" = m."productId" AND v."isDefault" = true;

CREATE INDEX "inventory_movements_variantId_idx" ON "inventory_movements"("variantId");
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: stock_requests
ALTER TABLE "stock_requests" ADD COLUMN "variantId" TEXT;

UPDATE "stock_requests" r
SET "variantId" = v."id"
FROM "product_variants" v
WHERE v."productId" = r."productId" AND v."isDefault" = true;

CREATE INDEX "stock_requests_variantId_idx" ON "stock_requests"("variantId");
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
