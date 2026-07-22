#!/bin/sh
set -e

cd /app/apps/api

# prisma db seed spawns `ts-node` by bare name — it must be on PATH
export PATH="/app/apps/api/node_modules/.bin:$PATH"

# Prefer the workspace-installed Prisma 6 binary. Never use bare `npx prisma`
# — that can download the latest major (Prisma 7) which breaks this schema.
if [ -x /app/node_modules/.bin/prisma ]; then
  PRISMA="/app/node_modules/.bin/prisma"
elif [ -x ./node_modules/.bin/prisma ]; then
  PRISMA="./node_modules/.bin/prisma"
else
  echo "✗ prisma binary not found in node_modules (expected Prisma 6.x)"
  ls -la /app/node_modules/.bin 2>/dev/null || true
  exit 1
fi

echo "→ Using Prisma: $PRISMA ($($PRISMA -v 2>/dev/null | tr '\n' ' '))"

# Fallbacks when Coolify injects empty strings (compose ${VAR:-default} does not apply then)
if [ -z "$JWT_ACCESS_SECRET" ]; then
  export JWT_ACCESS_SECRET="dev_access_secret_change_me"
  echo "⚠ JWT_ACCESS_SECRET empty — using dev default"
fi
if [ -z "$JWT_REFRESH_SECRET" ]; then
  export JWT_REFRESH_SECRET="dev_refresh_secret_change_me"
  echo "⚠ JWT_REFRESH_SECRET empty — using dev default"
fi
if [ -z "$DATABASE_URL" ]; then
  echo "✗ DATABASE_URL is not set"
  exit 1
fi

export PORT="${PORT:-4000}"

echo "→ DATABASE_URL host (redacted): $(echo "$DATABASE_URL" | sed -E 's#://([^:]+):[^@]+@#://\1:***@#')"
echo "→ Running Prisma migrations (retrying until DB is ready)..."
i=0
until "$PRISMA" migrate deploy; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "✗ prisma migrate deploy failed after ${i} attempts"
    exit 1
  fi
  echo "  attempt ${i} failed — retrying in 2s..."
  sleep 2
done

if [ "${SEED_ON_START:-false}" = "true" ] || [ "${SEED_ONLY:-false}" = "true" ]; then
  echo "→ Seeding database..."
  "$PRISMA" db seed || echo "⚠ Seed failed (continuing)"
fi

if [ "${SEED_ONLY:-false}" = "true" ]; then
  echo "→ SEED_ONLY complete — exiting"
  exit 0
fi

echo "→ Starting API on 0.0.0.0:${PORT}..."
exec node dist/main.js
