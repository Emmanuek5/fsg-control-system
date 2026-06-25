-- Enums
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
CREATE TYPE "CropInputType" AS ENUM ('SEED', 'FERTILIZER', 'HERBICIDE', 'PESTICIDE', 'OTHER');

-- Audit log
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Crop inputs (seeds, fertilizer, herbicides, ...)
CREATE TABLE "crop_inputs" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "type" "CropInputType" NOT NULL DEFAULT 'SEED',
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crop_inputs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crop_inputs_cropId_idx" ON "crop_inputs"("cropId");
ALTER TABLE "crop_inputs" ADD CONSTRAINT "crop_inputs_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Crop rotations
CREATE TABLE "crop_rotations" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "cropName" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crop_rotations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crop_rotations_cropId_idx" ON "crop_rotations"("cropId");
ALTER TABLE "crop_rotations" ADD CONSTRAINT "crop_rotations_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
