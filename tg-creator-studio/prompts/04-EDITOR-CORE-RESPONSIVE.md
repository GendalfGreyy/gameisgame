# 04 — Универсальный Editor Core и responsive workspace (G3)

Создай `editor-core`: command bus с `apply/undo`, selection manager, scene hierarchy operations (add/delete/duplicate/rename/reparent/reorder), transform commands, editor history, dirty/save states. Команда должна изменять ProjectDocument неизменно (Immer или чистые функции), validation интегрирован с schema. Реализуй тесты invariants и Undo/Redo inverses.

В Studio создай реальную рабочую desktop-компоновку: верхняя toolbar, Hierarchy слева, Viewport центр, Inspector справа, Assets/Blueprint/Console снизу. Для mobile: fullscreen canvas, touch tools и выдвижные bottom sheets. Никаких фиктивных Save/Undo/Redo; отображать их лишь при доступности команды. Подключи Inspector к command bus, desktop shortcuts и доступные мобильные кнопки.

ACCEPTANCE: создать/удалить/дублировать/переименовать/перенести узел hierarchy, изменить Transform через Inspector, Undo/Redo восстанавливает проект; на мобильном те же действия доступны без клавиатуры; UI использует единый `project-schema` и показывает честный save indicator. С реальным canvas интегрируем на этапе 05.
