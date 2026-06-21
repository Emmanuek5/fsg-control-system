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

## Quick start

```bash
# 1. install
pnpm install

# 2. configure env
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local   # NEXT_PUBLIC_API_URL is the relevant one

# 3. database
pnpm db:up          # start Postgres in Docker
pnpm db:migrate     # create schema
pnpm db:seed        # load roles, permissions, users & sample data

# 4. run everything
pnpm dev            # web :3000, api :4000 (Swagger at /api/docs)
```

### Seeded logins

| Role    | Email                | Password    |
| ------- | -------------------- | ----------- |
| Admin   | admin@fsg.local      | password123 |
| Manager | manager@fsg.local    | password123 |
| Staff   | staff@fsg.local      | password123 |

Roles and their permissions are fully editable in **Settings → Roles**.
