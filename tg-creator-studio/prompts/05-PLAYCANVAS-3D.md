# 05 — Реальный 3D Viewport и инструменты (G4)

Подключи `playcanvas` в `engine-3d` за интерфейсом адаптера (`createScene`, `applyChanges`, `select`, `dispose`). Реализуй Canvas/WebGL2, 3D grid, axes, camera orbit/pan/zoom, raycast selection, Transform gizmo Select/Move/Rotate/Scale, snapping, подсветку выделения, hierarchy ↔ viewport selection. Примитивы Cube/Sphere/Plane/Cylinder/Capsule, Light/Camera, Material(color, roughness, metalness), Inspector настроек; основные glTF/GLB модели по assetRef (через локальные fixtures, пока без API upload).

Прямые изменения внутренней PlayCanvas entity недопустимы как source of truth: любой gizmo drag производит Undoable EditorCommand, обновляет JSON и затем scene adapter. Корректно dispose ресурсов/обработчиков. Добавь различие editor camera и игровой камеры.

ACCEPTANCE: создать 3D сцену, мышью и касанием выделить куб, переместить, повернуть, масштабировать, изменить материал, Undo/Redo, закрыть/открыть проект с теми же параметрами. Проверь camera/orbit touch conflict. Unit tests adapter synchronization + Playwright interaction/screenshot smoke.
