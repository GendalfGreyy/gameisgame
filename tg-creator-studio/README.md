# TG Creator Studio — пакет ТЗ и промптов для Cursor

**Версия спецификации:** 1.1 • **Дата:** 10 октября 2026 • **Язык интерфейса:** русский.
См. `CHANGELOG.md` — что изменилось относительно 1.0.

## Цель

Разработать работающую платформу внутри Telegram Mini App для **создания, редактирования, тестирования и публикации** 3D-игр, 2D-игр и веб-приложений. Редактор работает с компьютера и телефона; публикации открываются в Telegram через единый бот.

Это план продукта, **не готовый исходный код**. Под «аналогом Roblox Studio / Unreal Engine» здесь подразумевается профессиональный браузерный конструктор со своей архитектурой; не перенос нативного UE5 или поддержка его закрытых технологий.

## Содержимое комплекта

| Файл                                  | Для чего                                                      |
| ------------------------------------- | ------------------------------------------------------------- |
| `CHANGELOG.md`                        | История версий спецификации; при правке docs фиксируйте здесь |
| `docs/01-PRODUCT-TZ.md`               | Полное техническое задание и функциональный объем             |
| `docs/02-UX-SCREENS.md`               | Карта экранов, десктопная/мобильная UX-спецификация, схемы    |
| `docs/03-ENGINE-ARCHITECTURE.md`      | Архитектура, модель данных, runtime, безопасность, потоки     |
| `docs/04-API-DATA-CONTRACT.md`        | Контракты REST, JSON-схемы, ошибки, сохранения                |
| `docs/05-ROADMAP-AND-QA.md`           | Этапы разработки (G0–G12), критерии приемки, QA               |
| `docs/06-ERROR-CATALOG.md`            | Нормативный реестр машинных error.code API                    |
| `.cursor/rules/tg-creator-studio.mdc` | Правила агента Cursor для этого проекта                       |
| `prompts/00-START-HERE.md`            | Основной установочный промпт Cursor                           |
| `prompts/01-*.md` … `10-*.md`         | Пошаговые промпты этапов R0→R1 (G0–G11)                       |
| `prompts/13-*.md`, `14-*.md`          | Промпты R2-расширений (collaboration, AI/marketplace)         |
| `examples/project-3d.v1.json`         | Минимальный валидный пример документной модели                |

## Как работать с Cursor

1. Создайте в Cursor папку `tg-creator-studio` и распакуйте внутрь этот комплект.
2. Откройте **Agent Mode** и вставьте содержимое `prompts/00-START-HERE.md`.
3. Давайте промпты по одному: 01→12 для R0/R1, 13→14 только после приёмки G12-предусловий. Вся работа внутри **одного репозитория**.
4. Каждый этап обязан завершиться блоком Definition of Done из `prompts/00-START-HERE.md`: зелёные lint/typecheck/tests, отчёт с командами и ссылками на файлы, обновлённые `TASKS.md`/`IMPLEMENTED.md`. Не переходите дальше при красных проверках.
5. Для Telegram: бот от BotFather, токен на сервере, публичный HTTPS-домен, настройка Mini App. Не публикуйте токен в коде.
6. Для локальной разработки разрешен **только dev-auth**, который блокируется в production.

## Соответствие промптов и gates

| Промпт | Gate              | Промпт | Gate                      |
| ------ | ----------------- | ------ | ------------------------- |
| 01     | G0 Infra          | 07     | G6 Play & Publish         |
| 02     | G1 Auth+Dashboard | 08     | G7 Blueprint              |
| 03     | G2 Project schema | 09     | G8 2D Studio              |
| 04     | G3 Editor core    | 10     | G9 App Builder            |
| 05     | G4 3D engine      | 11     | G10 Mobile QA             |
| 06     | G5 Assets & Save  | 12     | G11 Production            |
| —      | —                 | 13, 14 | G12 R2 (по подконтрактам) |

## Реалистичный первый релиз

Пользователь в Telegram авторизуется, создает 3D-проект, добавляет/двигает объекты, сохраняет, закрывает и открывает редактор без потери данных, запускает сцену, публикует версию и делится ссылкой. **После** этой вертикальной функции добавляются Blueprint, 2D, App Builder, шаблоны, multiplayer и AI.

## Официальные ориентиры (проверить версии и API перед реализацией)

- Telegram Mini Apps: https://core.telegram.org/bots/webapps
- PlayCanvas Engine: https://developer.playcanvas.com/user-manual/engine/
- PlayCanvas open-source Editor: https://github.com/playcanvas/editor
- PixiJS v8: https://pixijs.com/8.x/guides/components/renderers
- React Flow: https://reactflow.dev/
- Yjs: https://docs.yjs.dev/
- Rapier physics: https://rapier.rs/
