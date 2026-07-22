#!/bin/sh
set -e

cd /app/apps/api

echo "→ Running Prisma migrations..."
npx prisma migrate deploy

if [ "${SEED_ON_START:-false}" = "true" ] || [ "${SEED_ONLY:-false}" = "true" ]; then
  echo "→ Seeding database..."
  npx prisma db seed || echo "⚠ Seed failed (continuing)"
fi

if [ "${SEED_ONLY:-false}" = "true" ]; then
  echo "→ SEED_ONLY complete — exiting"
  exit 0
fi

echo "→ Starting API on port ${PORT:-4000}..."
exec node dist/main.js
