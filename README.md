# FSG Work Solutions — Management Portal

A web-based control system for running FSG Work Solutions' subsidiaries (online shop, farm
divisions, assets, land/estate, investments) with a live executive dashboard and dynamic
role-based access control.

## Stack

| Layer       | Tech                                                        |
| ----------- | ----------------------------------------------------------- |
| Monorepo    | pnpm workspaces + Turborepo                                 |
| Frontend    | Next.js 15 (App Router) · TypeScript · Tailwind · Recharts  |
| Backend     | NestJS · Prisma · Passport-JWT                              |
| Database    | PostgreSQL 16 (Docker for local dev)                        |
| Shared      | `@fsg/shared` — zod schemas, types, permission catalog      |
| Auth        | JWT (access + httpOnly refresh) with **dynamic RBAC**       |

```
control-system/
├─ apps/
│  ├─ web/        # Next.js frontend
│  └─ api/        # NestJS backend (owns Prisma schema)
└─ packages/
   └─ shared/     # types, zod schemas, permission catalog
```

## Quick start (local dev)

```bash
# 1. install
pnpm install

# 2. configure env
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local   # NEXT_PUBLIC_API_URL is the relevant one

# 3. database only
pnpm db:up          # start Postgres in Docker
pnpm db:migrate     # create schema
pnpm db:seed        # load roles, permissions, users & sample data

# 4. run API + web on the host
pnpm dev            # web :3000, api :4000 (Swagger at /api/docs)
```

## Full stack via Docker Compose

Runs Postgres + API + web (migrations apply automatically on API start):

```bash
cp .env.example .env
# For compose, set DATABASE_URL host to `postgres`:
# DATABASE_URL="postgresql://fsg:fsg_password@postgres:5432/fsg_control?schema=public"

pnpm docker:up      # docker compose up -d --build
pnpm docker:seed    # optional: roles + sample users
# web http://localhost:3000  ·  api http://localhost:4000/api/docs
pnpm docker:down
```

### Coolify

1. Deploy this repo as a **Docker Compose** resource.
2. Set secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_PASSWORD`, Monnify keys as needed.
3. Set public URLs:
   - `WEB_ORIGIN` → your web domain (e.g. `https://app.example.com`)
   - `NEXT_PUBLIC_API_URL` → your API domain (e.g. `https://api.example.com`) — **rebuild web** after changing
   - `DATABASE_URL` → `postgresql://…@postgres:5432/…` (service name inside compose)
4. Set `COOKIE_SECURE=true` when serving over HTTPS.
5. First deploy: `SEED_ON_START=true` once (or run `pnpm docker:seed`), then turn it off.
6. Point domains at the `web` service (UI) and `api` service (API + Monnify webhooks).

### Seeded logins

| Role    | Email                | Password    |
| ------- | -------------------- | ----------- |
| Admin   | admin@fsg.local      | password123 |
| Manager | manager@fsg.local    | password123 |
| Staff   | staff@fsg.local      | password123 |

Roles and their permissions are fully editable in **Settings → Roles**.
