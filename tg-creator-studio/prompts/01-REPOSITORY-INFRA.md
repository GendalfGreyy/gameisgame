# 01 — Инфраструктура и старт репозитория (G0)

Прочитай проектные документы и `TASKS.md`. Реализуй только G0.

Создай pnpm + Turborepo monorepo: `apps/studio`, `apps/player`, `apps/api`, `apps/worker`, `packages/project-schema`, `editor-core`, `engine-3d`, `engine-2d`, `app-runtime`, `logic-engine`, `physics`, `telegram`, `asset-sdk`, `ui-kit`, `shared`. Scaffold без фиктивных обещаний: пустые пакеты должны иметь ясный статус Planned. Настрой React + Vite + TS strict для studio/player, NestJS + Prisma для API, PostgreSQL в docker-compose, lint, formatter, Vitest, Playwright, CI pipeline, `.env.example`, README dev scripts. Создай единый format для ошибок и конфигурации.

ВАЖНО: никакой автоматической установки агрессивно несовместимых версий; закрепи совместимые версии через lockfile. База поднимается локально одной командой; API healthcheck реально возвращает healthy после проверки зависимости от БД; Studio показывает базовую рабочую оболочку, Player — отдельную оболочку без панели редактора.

ACCEPTANCE: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` работают; `docker compose up -d` запускает зависимости; `pnpm dev` поднимает нужные приложения; CI запускает проверки. Укажи версии Node/pnpm в документации. В `IMPLEMENTED.md` перечисли готовые модули, а не будущие. Далее только после моих инструкций или автоматически после проверки приступай к 02.
