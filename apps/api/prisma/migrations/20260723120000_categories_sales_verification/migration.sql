-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Backfill categories from the existing product category values
INSERT INTO "categories" ("id", "name", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text || category_name),
    category_name,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT trim("category") AS category_name
    FROM "products"
    WHERE "category" IS NOT NULL AND trim("category") <> ''
) AS existing_categories;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "categoryId" TEXT;

UPDATE "products"
SET "categoryId" = "categories"."id"
FROM "categories"
WHERE trim("products"."category") = "categories"."name";

ALTER TABLE "products" DROP COLUMN "category";

-- AlterTable
ALTER TABLE "sales"
ADD COLUMN "verifiedById" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "proofUrl" TEXT,
ADD COLUMN "inventoryMovementId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sales_inventoryMovementId_key" ON "sales"("inventoryMovementId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "inventory_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
