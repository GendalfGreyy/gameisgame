# CLAUDE.md — packages/shared

Single source of truth for types and contracts shared between `apps/web` and `apps/api` (and bot where applicable).

## Layout

- `src/types/` — pure TypeScript types and enums mirroring Prisma where they cross the network boundary.
- `src/schemas/` — zod schemas for every request/response DTO.
- `src/constants/` — domain constants (point amounts, fraud weights, boost prices, geo radii defaults).

## Patterns

- Every API endpoint has matching `<name>Request` and `<name>Response` zod schemas exported from `src/schemas/`. Frontend infers types via `z.infer<typeof X>`.
- Constants are `as const` and exported by name, not as a default object. Tree-shakable.
- No runtime side effects on import. No `console.log`, no I/O, no `process.env` access.

## DO NOT

- Do not import from `@game-is-game/api` or `@game-is-game/web`. This package is a leaf.
- Do not import Prisma client. Mirror types by hand or re-derive from zod — keeps the package consumable from the browser.
- Do not put feature logic here. This is contracts only.
