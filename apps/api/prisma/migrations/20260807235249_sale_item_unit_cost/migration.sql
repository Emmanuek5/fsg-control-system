-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill existing lines from today's cost prices (variant first, then the
-- product's) — the best available approximation for sales recorded before
-- costs were snapshotted.
UPDATE "sale_items" si
SET "unitCost" = COALESCE(
  NULLIF((SELECT pv."costPrice" FROM "product_variants" pv WHERE pv."id" = si."variantId"), 0),
  (SELECT p."costPrice" FROM "products" p WHERE p."id" = si."productId"),
  0
);
