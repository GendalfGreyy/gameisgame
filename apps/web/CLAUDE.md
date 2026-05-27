# CLAUDE.md — apps/web (Telegram Mini App)

React 18 + Vite + TypeScript + Tailwind + TanStack Query + Zustand + MapLibre GL + `@twa-dev/sdk` + framer-motion.

## Architecture (feature-sliced light)

- `src/pages/` — route-level components only (composition, no logic).
- `src/features/<name>/` — `api.ts`, `hooks.ts`, `components/`, `store.ts`. Each feature is independently deletable.
- `src/shared/ui/` — design system primitives: `Button`, `Card`, `Sheet`, `Chip`, `Avatar`, `Badge`, `Skeleton`. No business logic here.
- `src/shared/api/` — fetcher + TanStack Query setup; auth header is injected once.
- `src/shared/lib/` — pure utils (geohash, distance formatting, i18n time).
- `src/shared/types/` — re-exports from `@game-is-game/shared`. App-local types live next to where they are used.

## Patterns

- Server state: TanStack Query. Client state: Zustand (one store per feature, no global god-store).
- All TG interactions go through `src/shared/lib/telegram.ts` — never import `@twa-dev/sdk` in feature code.
- Tailwind tokens: `themeParams` is mapped into CSS variables (`--tg-bg`, `--tg-text`, `--tg-accent`). Always use these — never hardcode hex.
- Spacing scale: 4/8/12/16/24/32 only. Typography: 12/14/16/18/24/32 only.

## DO NOT

- Do not store JWTs in `localStorage` (use `sessionStorage` + Zustand in-memory).
- Do not import server-only deps. No `process.env.SECRET_*`.
- Do not write generic SaaS UI. Read `/mnt/skills/public/frontend-design/SKILL.md` before designing new screens (phase 6).
- Do not call `navigator.geolocation` outside `features/privacy` — that module owns all location reads and applies the user's privacy mode.
