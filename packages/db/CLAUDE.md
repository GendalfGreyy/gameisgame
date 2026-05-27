# CLAUDE.md — packages/db (Prisma schema)

Owns: `schema.prisma`, SQL migrations, seed scripts, PostGIS extension setup.

## Workflow

```bash
pnpm --filter @game-is-game/db prisma migrate dev --name <slug>   # create + apply migration locally
pnpm --filter @game-is-game/db prisma migrate deploy              # production
pnpm --filter @game-is-game/db prisma db seed                      # local dev data
pnpm --filter @game-is-game/db prisma studio                       # GUI
```

## Conventions

- One migration = one logical change. Do not edit existing migration files after they are merged.
- PostGIS extension is created in the first migration (`CREATE EXTENSION IF NOT EXISTS postgis`).
- Geographic columns: `geo_point geography(Point, 4326)` with a `GIST` index.
- Soft delete only on `User` (`deleted_at`). Everything else hard-deletes with explicit cascade rules.
- Enums: prefer Prisma enums over free text. Add new values via migration, never edit in place.

## Seeding

`prisma/seed.ts` creates a deterministic, idempotent dev fixture (5 users, 2 communities, 3 venues, 10 events, 15 check-ins, 30 points ledger entries). It must run cleanly against an empty or existing dev DB.

## DO NOT

- Do not edit a migration file after it lands on `main`. Create a new corrective migration instead.
- Do not run `prisma migrate reset` against a non-local database — ever.
- Do not store secrets, personal contact info, or message bodies in this schema. PII surface should stay narrow.
