# 11 — Настоящее управление с телефона и QA (G10)

Используй `docs/02-UX-SCREENS.md` как нормативную спецификацию. Пройди все флоу S01-S20 на viewport эмуляциях и реальных Telegram devices, исправь mobile WebView bugs. Поддержи safeArea, contentSafeArea, stable viewport, conditional fullscreen, gesture conflicts, keyboard overlaps, landscape, orientation change, visual viewport updates, haptics только если доступны.

Реализуй touch-only точное редактирование Transform, add/reparent/delete, blueprint connection через node chooser (без необходимости попадать в 5px порт), App Builder reorder без desktop drag, asset upload через file picker. Сделай FPS/quality presets и восстановления WebGL context. Проверь BackButton/unsaved confirmation/Play exit.

ACCEPTANCE: приемочные сценарии A-D (см. roadmap) на Android/iOS + Telegram Desktop; каждое действие возможно без keyboard; кнопки не прячутся за Telegram safe areas; Player стабилен на Low graphics. Обязательный баг-лист с reproductions и исправлениями.
