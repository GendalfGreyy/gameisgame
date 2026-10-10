# IMPLEMENTED — TG Creator Studio

Журнал фактической готовности. Не помечай Completed без зелёного DoD.

## Spec package

| Item                                                                              | Status    | Notes                                   |
| --------------------------------------------------------------------------------- | --------- | --------------------------------------- |
| Spec 1.0 body (`docs/01–05`, prompts 01–14, `examples/project-3d.v1.json`)        | Completed | Импортировано из загруженного комплекта |
| Spec v1.1 upgrade (README, CHANGELOG, docs/06, rules 13–15, DoD, docs/04–05 sync) | Completed | 2026-10-10                              |
| Runtime / editor code per gates G0+                                               | Partial   | G0 infra Done; продуктные gates Planned |

## G0 Infra

| Item                                                      | Status    | Notes                                                 |
| --------------------------------------------------------- | --------- | ----------------------------------------------------- |
| `ARCHITECTURE.md` mapping → game-is-game monorepo         | Completed | `apps/creator-api` вместо `apps/api`                  |
| `packages/creator-shared` (`@tg-creator/shared`) ApiError | Completed | коды из docs/06 + INTERNAL/SERVICE_UNAVAILABLE        |
| `packages/project-schema` Zod v1 + roundtrip example      | Completed | мигратор stub (только v1)                             |
| Planned stubs: editor-core…ui-kit                         | Completed | `PACKAGE_STATUS = 'Planned'`                          |
| `apps/studio` editor shell                                | Completed | hierarchy / viewport / inspector placeholders         |
| `apps/player` player shell (no editor-core)               | Completed |                                                       |
| `apps/creator-api` NestJS + Prisma + `/health` (DB check) | Completed | port 3010                                             |
| `apps/worker`                                             | Planned   | process marker only                                   |
| docker-compose Postgres/Redis                             | Completed | shared with Game is Game                              |
| `.env.example` Creator vars                               | Completed |                                                       |
| CI (lint/typecheck/build/test)                            | Completed | existing root workflow covers new workspaces          |
| Playwright smoke for studio shell                         | Partial   | config + e2e spec; run via `pnpm --filter … test:e2e` |

## Product vertical (R0/R1)

| Capability                 | Status  |
| -------------------------- | ------- |
| Telegram auth              | Planned |
| Project CRUD + schema      | Partial |
| 3D editor edit/save/reopen | Planned |
| Play mode                  | Planned |
| Publish + share link       | Planned |
