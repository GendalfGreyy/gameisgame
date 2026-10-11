# 02 — Telegram Auth и Dashboard (G1)

Реализуй аутентификацию через raw `Telegram.WebApp.initData` с серверной проверкой подписей/HMAC, сроком `auth_date`, secure session и ограничением доступа. `initDataUnsafe` разрешено только для некритичной визуализации, ни при каких обстоятельствах — как идентификатор авторизации. DevAuth только в `NODE_ENV=development`, hard-fail в production. Добавь `User` и `Project` в Prisma.

Создай реальные экраны S01–S03: загрузка, dashboard, wizard. Подключи `GET/POST /api/v1/projects`, `GET /me`; проект создается в БД с ownerId из серверной сессии. Навигация desktop sidebar и mobile bottom navigation. Telegram theme/viewport/BackButton через изолированный bridge с fallback для обычного браузера при разработке.

ACCEPTANCE: по тестовому Telegram initData авторизация проходит, неверный hash/старый auth_date — 401; создать проект → после refresh он остается; пользователь B не видит проект A; мобильный dashboard и wizard работают. Playwright E2E dashboard create; unit auth signature tests. Зафиксируй реализацию и ограничения внешнего тестирования.
