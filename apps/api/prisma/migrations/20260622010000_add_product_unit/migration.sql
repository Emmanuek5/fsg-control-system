-- Add unit of measure to products (pcs, kg, crate, bag, ...).
ALTER TABLE "products" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'pcs';
