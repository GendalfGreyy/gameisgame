# CLAUDE.md — apps/api (NestJS backend)

Owns: auth, events, check-ins, points, leaderboard, payments (Stars), bot job queue producer, moderation, admin endpoints.

## Module layout

`src/modules/<feature>/` — each feature module is self-contained: `*.controller.ts`, `*.service.ts`, `dto/`, `*.spec.ts`. Cross-cutting code lives in `src/common/` (guards, interceptors, pipes, decorators).

## Patterns

- Validation: zod schemas from `@game-is-game/shared`, applied through a custom `ZodValidationPipe`. Do not duplicate validation logic with class-validator.
- All endpoints have an explicit `@UseGuards(JwtAuthGuard)` or `@Public()` decorator. There is no implicit auth.
- Geo queries: Prisma `$queryRaw` with PostGIS. Always parameterize — never interpolate.
- Background work: BullMQ producer in api, consumer in bot. Bot never reads from PG directly except for read-only joins on its own jobs.
- Errors: throw `HttpException` subclasses; global filter formats them. No string `throw`.
- Audit: every admin-role action goes through `AuditLogInterceptor` → writes to `AdminAuditLog`. No exceptions.

## DO NOT

- Do not write to `User.total_points` directly. Use `PointsService.award` which writes to `PointsLedger`.
- Do not log `initData`, JWTs, refresh tokens, or full request bodies of auth endpoints.
- Do not call `prisma.<model>.deleteMany` without a `where` clause in production code paths.
- Do not catch and swallow errors silently. Log structured with Pino and rethrow or return a typed result.
