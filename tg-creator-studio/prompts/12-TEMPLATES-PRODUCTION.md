# 12 — Шаблоны, безопасность, релиз R1 (G11)

Подготовь работающие templates: 3D Obby, 3D Room, 2D Platformer, 2D Clicker, App Catalog, App Form. Каждый шаблон — валидный versioned project snapshot, создается как новая копия, имеет preview, действительно работает после Play и Publish. Сделай library, template picker и документацию по extensions.

Проведи release hardening: dependency/license audit, auth bypass tests, project ACL, Data Collection policy, malicious asset handling, unsafe URL/XSS, graph execution quotas, quotas/ratelimit, publish transaction rollback, CSRF/CORS, S3 permissions, backend backup+restore, staging bot, production HTTPS, telemetry and error tracking. Документируй performance budgets на эталонных устройствах.

ACCEPTANCE: автоматические unit/integration/e2e tests зеленые; сценарии A-E полностью; каждый template загружается и публикуется; ни один placeholder не объявлен готовой функцией. Напиши `RELEASE-CHECKLIST.md` с блокерами и реальным статусом R1.
