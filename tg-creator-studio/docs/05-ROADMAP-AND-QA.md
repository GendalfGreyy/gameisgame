# 05. План реализации и критерии приемки

## 1. Правило работы Cursor

Не переходить к новой стадии, пока не выполняются ее тесты. Любое «сделано» означает файл кода, работающий сценарий и результаты проверок. Каждая стадия заканчивается обновлением `TASKS.md` и `IMPLEMENTED.md` с разделением Completed/Partial/Planned. Промпты выполняются **последовательно** в одном repo. В случае контекстного обрыва агент читает TASKS, восстанавливает состояние и продолжает следующую незавершенную задачу. Не начинать новый backend, frontend или storage заново.

## 2. Release gates

| Gate | Промпт | Этап                        | Готово, когда...                                                       |
| ---- | ------ | --------------------------- | ---------------------------------------------------------------------- |
| G0   | 01     | Infra                       | Monorepo, DB, docker, dev commands, lint/typecheck/test CI запускаются |
| G1   | 02     | Auth+Dashboard              | Telegram auth verified; проект создается и виден только владельцу      |
| G2   | 03     | Project schema              | Typed JSON roundtrip, migrations, revision conflicts тестируются       |
| G3   | 04     | Editor core & responsive UI | Commands, selection, Undo/Redo, hierarchy работают ПК + touch          |
| G4   | 05     | 3D engine                   | Примитивы/GLB/материалы/gizmos/camera scene восстановимы               |
| G5   | 06     | Assets & Save               | Upload pipeline, autosave, offline notice, reload preserving data      |
| G6   | 07     | Play & Publish              | Game player по Telegram deep link читает immutable snapshot            |
| G7   | 08     | Blueprint                   | 5+ разных исполняемых графов с типами и debug без eval                 |
| G8   | 09     | 2D Studio                   | 2D platformer реально играет, коллизии/счет/controls работают          |
| G9   | 10     | App Builder                 | 2-page CRUD app через visual builder с policy на данные                |
| G10  | 11     | Mobile optimization         | Полный core workflow touch на iOS/Android Telegram, keyboard/safe area |
| G11  | 12     | Templates+quality           | Шаблоны, profiling, regression tests, backup, staging, security audit  |
| G12  | 13–14  | R2 expansion                | Multiplayer, collaboration, marketplace, AI — отдельные подконтракты   |

Таблица «промпт ↔ gate» совпадает с `README.md` (v1.1).

## 3. Сквозные сценарии приемки

**A — 3D creation, desktop ↔ mobile**: Создать с ПК проект «Mini Obby»; добавить Ground/Cube/Camera; перетащить куб через gizmo и числовой Inspector; сохранить; открыть тот же проект на смартфоне, изменить цвет и position; дождаться Saved; вернуться на ПК и проверить изменения; Play; Publish; отправить ссылку второму аккаунту; второй аккаунт запускает версию и не видит редактор.

**B — Blueprint**: OnStart → SetVariable(score,0); OnCollision(Player,Coin) → Add(1) → SetVariable(score) → Destroy(Coin) → UI.SetText(score). В Play при столкновении монета исчезает, счет растет один раз; неверная связь типов помечена ошибкой до публикации.

**C — 2D mobile game**: Создать 2D из template, переместить платформу касанием, положить монету, Play, джойстиком подойти и нажать Jump, объект физически сталкивается с платформой, монета начисляется. После Exit редактор продолжает показывать сохраненные координаты, а не состояние игрового запуска.

**D — App Builder**: На телефоне создать 2 страницы: Catalog/OrderForm, выбрать List и Button, подключить Data Collection Products и Orders, настроить list read и authenticatedOwnRows write; Publish; другой пользователь видит продукты, создает **свою** заявку, не читает/не редактирует чужую.

**E — Conflict and failures**: Открыть проект на двух устройствах, внести конкурирующие изменения, проверить 409/merge UI; выключить сеть на телефоне, продолжить правку, убедиться, что статус не «Сохранено в облаке»; после reconnect восстановить и подтвердить версию.

## 4. Обязательные тесты

- Unit: project-schema, scene graph integrity, EditorCommands inverses, graph typing/limits, serializers, migration functions.
- Component: Inspector → command bus, mobile sheets, Blueprint port connect, save status.
- Integration: auth session, project ACL, revision handling, uploads, publish version, data collection policy.
- E2E Playwright: S02→S04→S12→S13→S15; S02→S06→CRUD→S15; cross-device viewport emulation.
- Device smoke: Telegram Android WebView, Telegram iOS WKWebView, Telegram Desktop/Web where relevant; test touch, virtual keyboard, fullscreen fallback.
- Security: unauthorized access, broken initData, malicious file, unsafe URL, unbounded graph, XSS, SSRF connector, stale session.
- Recovery: DB snapshot restore, no draft loss after normal saved close, worker failure on publish, S3 temporary errors.

## 5. Performance goals, not promises

- В production регулярно фиксировать эталонные устройства (минимум один бюджетный Android, один iPhone, один десктоп) и измерять время загрузки + FPS на фиксированных тестовых сценах.
- Цель Play: минимум 30 FPS на бюджетном мобильном устройстве для малой сцены из 50 примитивов; 60 FPS на десктопе для сцены из 100 примитивов, по median после warmup. Превышения должны автоматически включать low preset.
- UX: главный поток «создать → добавить объект → сохранить» достижим без невидимых действий и без клавиатуры в mobile mode.
- Лимиты upload, texture sizes, максимальной глубины дерева, Blueprint steps/fps, Data Collection calls, project total size задаются конфигом и проверяются сервером.

## 6. Измеримые продуктовые метрики

`new_project_created`, `edit_session_started`, `object_added`, `save_acknowledged`, `play_started`, `play_completed`, `publish_succeeded`, `player_opened`, `publish_link_shared`, `blueprint_validation_failed`, `asset_processing_failed`, crash-free sessions. Без отправки пользовательских секретов и приватного содержимого проектов в аналитические события.

## 7. Что не делать в ранней версии

- Полный UE5 renderer, Nanite/Lumen, собственный 3D-моделлер с rigging.
- Публичный marketplace и платежи до проверки модерации/прав/правил Telegram.
- Arbitrary JavaScript/HTML user code в Player.
- Настоящий real-time coediting без CRDT-конфликтной модели.
- Генерацию production-игры AI «одним промптом» без проверки и deterministic build.
- Одновременное внедрение PlayCanvas built-in Ammo и независимого Rapier rigidbody на один объект.

## 8. Оценка порядка величины

Это **многомесячный инженерный проект**, даже с Cursor. Для небольшого опытного состава разработчиков ориентир: рабочая вертикаль R0 — от нескольких недель до нескольких месяцев, R1 с надежными 3D/2D/App Builder/Blueprint и мобильной поддержкой — существенно дольше, R2 — отдельная крупная программа. Точные сроки зависят от состава команды, готовых библиотек и критериев качества; это не фиксированная оценка.
