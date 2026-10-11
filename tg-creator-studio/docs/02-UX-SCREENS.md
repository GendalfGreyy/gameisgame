# 02. Экраны, UX и адаптивный редактор

## 1. Общие правила UX

Пользователь работает с одним и тем же проектом в ПК- и мобильной версиях. **Функциональная модель общая, компоновка разная.** ПК оптимизирован под мышь/клавиатуру/несколько панелей; мобильная версия — под редактирование касанием, полноэкранный viewport и последовательные операции без мелких кнопок. Синхронизация проходит через сервер; разные устройства могут открывать одну работу.

Тема по умолчанию — темный нейтральный интерфейс с фиолетово-синим акцентом, контрастными статусами и фокусом на сцене. Минимальные размеры touch-контролов — ориентировочно 44×44 CSS px, кроме явно недоступных для касания декоративных элементов. Переключатель «Компактный/Удобный» для плотности UI. Никакая критичная функция не должна жить только в контекстном меню ПК или hover.

### Навигация

`Home → Project Wizard → Editor → Play Preview → Publish Dialog → Project Page → Player`.

Дополнительные маршруты: `Assets Library`, `Templates`, `My Projects`, `Project Settings`, `Versions`, `Data Collections`, `Account`, `Error/Offline`, `Help`.

## 2. Таблица экранов и состояний

| ID  | Экран                    | ПК                          | Телефон                               | Основные действия                                    |
| --- | ------------------------ | --------------------------- | ------------------------------------- | ---------------------------------------------------- |
| S01 | Загрузка / Telegram Auth | Скелетон и ошибки           | Короткий fullscreen loader            | Проверка initData, восстановление последнего проекта |
| S02 | Главная                  | Sidebar + карточки проектов | Search + карточки + нижняя навигация  | Create, Resume, Duplicate, Delete                    |
| S03 | Мастер проекта           | Modal/Wizard                | Fullscreen wizard                     | Type → Template → Name → Create                      |
| S04 | 3D Scene Editor          | Dockable workspace          | Viewport + action bar + bottom sheets | Объекты, материалы, компоненты                       |
| S05 | 2D Scene Editor          | Dockable workspace          | Viewport + touch tools                | Sprite, collision, layers                            |
| S06 | App UI Builder           | Page tree/canvas/Inspector  | Preview page + component sheet        | CRUD UI, responsive layout                           |
| S07 | Blueprint Editor         | Граф + узлы + debugger      | Zoomable graph + node chooser         | Добавить, связать, проверить граф                    |
| S08 | Asset Browser            | Drawer/grid/list            | Fullscreen gallery                    | Импорт, preview, выбор                               |
| S09 | Inspector                | Правая панель               | Нижний sheet                          | Свойства выбранного объекта                          |
| S10 | Hierarchy / Layers       | Левая панель                | Bottom sheet                          | Выбор, parenting, порядок                            |
| S11 | Animation / Timeline     | Нижняя панель (R2)          | Fullscreen tab (R2)                   | Keys, clips, events                                  |
| S12 | Play Preview             | Сцена + debug tools         | Fullscreen game                       | Тест; Exit Play                                      |
| S13 | Publish Dialog           | Modal: validation+versions  | Многошаговый sheet                    | Название, preview, publish                           |
| S14 | Project Page             | Обложка и CTA               | Вертикальный постер и CTA             | Play, Share, Author                                  |
| S15 | Player                   | Автономная страница         | Fullscreen при поддержке              | Только runtime, без editor rights                    |
| S16 | Version History          | Таблица diff/time           | Список снапшотов                      | View, rollback-as-new-draft                          |
| S17 | Data Collections         | Таблица и schema builder    | Формы + карточки                      | Schema, records, permissions                         |
| S18 | Settings / Permissions   | Tabs                        | Пошаговые настройки                   | Quality, quotas, privacy, team (R2)                  |
| S19 | Console / Diagnostics    | Нижняя консоль              | Fullscreen log drawer                 | Ошибки, фильтры, узел-источник                       |
| S20 | Offline / Conflict       | Persistent status/dialog    | Баннер + recover sheet                | Retry / Merge / Copy snapshot                        |

## 3. Desktop 3D Studio — схема 1440×900

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ TG Creator  / My World        [Scene][UI][Blueprint]     Saved ✓  ▶ Play  Publish│
├──────────────────┬──────────────────────────────────────┬───────────────────────┤
│ HIERARCHY        │     VIEWPORT                         │ INSPECTOR             │
│ ▾ MainScene      │ [Select][Move][Rotate][Scale]        │ Cube                  │
│   Camera         │                   Y↑                 │ Transform             │
│   Light          │             ┌───────┐                │ Position [0,1,0]      │
│   ▸ Player       │          X← │ CUBE  │ →Z             │ Rotation [0,0,0]      │
│   Cube           │             └───────┘                │ Scale    [1,1,1]      │
│   Ground         │     Grid / Gizmo / Camera            │ Material / Physics    │
│ [+ Add Object]   │                                      │ [+ Add Component]     │
├──────────────────┴──────────────────────────────────────┴───────────────────────┤
│ [Assets] [Blueprint] [Timeline R2] [Console]  tabs / resizable bottom workspace │
│ Models   Textures   Sounds     drag resources to viewport                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Поведение:** drag handles панелей, запрет закрытия последней панели сцены, сохранение layout preferences локально. Двойной клик по объекту → Focus camera. F — focus selection; W/E/R — Move/Rotate/Scale; Delete, Ctrl/Cmd+Z / Shift+Z, Ctrl/Cmd+D. Есть видимые кнопки-аналоги. Tab скрывает панели. Клик по пустой области снимает selection. Новые сущности возникают на плоскости размещения перед камерой или на сетке по raycast; при невозможности — возле origin.

**Inspector:** property schema задает control и range. Изменение position через числовое поле генерирует **ту же EditorCommand**, что gizmo. Нажатие Play автоматически сохраняет или спрашивает про несохраненное состояние; запускается копия снапшота.

**Реализовано в G3:** desktop-компоновка включается при ширине ≥ 1024 px (ниже — мобильная). Undo/Redo всегда видны и заблокированы, когда шага нет; кнопка «Сохранить» появляется только при несохранённых изменениях или ошибке сохранения. Индикатор: «Сохранено» (только после ответа сервера), «Не сохранено», «Сохранение…», «Ошибка сохранения», «Нет связи», «Конфликт версий» (с выбором «Загрузить версию с сервера» / «Сохранить мою как копию»). Горячие клавиши: Ctrl/Cmd+S, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y, Ctrl/Cmd+D, Delete, F2 (переименовать), Esc (снять выделение), F (показать выделенное), Q/W (Выбор/Перемещение). На desktop удаление без подтверждения (откатывается Undo), на mobile — с подтверждением. Reparent: drag-and-drop в иерархии (desktop) и пункт «Переместить в…»/«Вложить»/«Вынести» в меню строки (везде). Rotate/Scale gizmo, Tab, изменение размеров панелей — G4.

## 4. Mobile 3D Studio — портретная схема

```text
┌──────────────────────────────────┐
│ ← My World       ● Saved    ▶   │ ← safe area
├──────────────────────────────────┤
│ [Select] [Move] [Rotate] [Scale] │
│                                  │
│                                  │
│          FULLSCREEN              │
│             SCENE                │
│                                  │
│                   ⊕              │
│                        [Camera]  │
│                                  │
├──────────────────────────────────┤
│ Cube selected  ···   [Properties]│
│ [Objects] [Assets] [Logic] [More]│ ← нижняя панель
└──────────────────────────────────┘
        при открытии Inspector:
┌──────────────────────────────────┐
│ ━━━━━━  Cube   [×]               │
│ Transform                        │
│ Position   X [0] Y [1] Z [0]    │
│ Rotation   X [0] Y [0] Z [0]    │
│ Scale      X [1] Y [1] Z [1]    │
│ [Add component]                  │
└──────────────────────────────────┘
```

### Мобильные жесты (строгий UX-контракт)

- **Select mode:** tap — выделение; повторный tap — контекстные действия. Tap на пустой области — снять выделение.
- **Orbit mode:** один палец — вращать камеру вокруг точки фокуса; два пальца — pan; pinch — zoom. При выбранном gizmo однопальцевый drag над ручкой двигает объект; drag вне ручки управляет камерой (в режиме Orbit).
- **Move/Rotate/Scale:** выделенная ось становится крупной touch-мишенью; панель X/Y/Z и переключатель World/Local доступны без drag.
- **Add:** отдельная `+` кнопка → объект, ресурс, prefab, свет, камера. После выбора объект отображается в сцене и можно откатить действие.
- **Hierarchy:** bottom sheet высотой 40–90% экрана, search, collapsible rows, drag handle для reparent, удаление с подтверждением.
- **Inspector:** vertical scroll sheet, numeric keypad для трансформаций, буфер Reset/Copy/Paste component.
- **Blueprint:** отдельный fullscreen graph с pinch zoom, mini-map по кнопке, поиском узлов, добавлением соединения «от порта → выбрать подходящий вход»; точные мелкие коннекторы не обязательны для касаний.
- **Play:** затемнение/скрытие editor UI; кнопка `Выйти из Play` всегда доступна, системная кнопка «Назад» не теряет проект.
- **Реализовано в G3:** fullscreen-схема сцены, переключатель Выбор/Перемещение поверх canvas, `+` (FAB) → лист «Добавить объект», панель выделения (Дублировать / Удалить / Свойства), нижняя навигация Объекты / Свойства / Ассеты / Логика / Консоль, bottom sheets 60% → 90%, числовые поля с `inputMode="decimal"` (запятая допускается), системная кнопка «Назад» сначала закрывает лист, а при несохранённых изменениях спрашивает подтверждение. Orbit-режим и touch-gizmo — G4.
- **Безопасная область:** `safeAreaInset`, `contentSafeAreaInset`, `viewportStableHeight`; обновление при повороте и изменении viewport. Ориентация — свободная по умолчанию, landscape опционально.

## 5. Desktop 2D Studio

Hierarchy слева; по центру 2D viewport с масштабом, сеткой, camera bounds, тайл-палитрой; Inspector справа; снизу Assets/Animations/Blueprint/Console. Расстановка спрайтов, изменение layer/sortOrder, collider overlay. В редакторе видны collision shapes. В Play — UI счетчика и кнопки управления.

**Мобильная версия:** переключатель инструментов `Select / Draw / Erase / Collider`, touch paint для тайлов, контекстное редактирование объектов через bottom sheet, кнопки создания спрайтов через assets.

## 6. Desktop App Builder

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ My Shop             Desktop | Tablet | Mobile  Preview  Publish              │
├──────────────────┬───────────────────────────────────┬───────────────────────┤
│ PAGES            │ COMPONENT CANVAS                  │ PROPERTIES            │
│ Home             │ ┌───────────────────────────────┐ │ Layout & Style        │
│ Product          │ │ Header / Logo                 │ │ Text                  │
│ Cart             │ ├───────────────────────────────┤ │ Binding               │
│ COMPONENTS       │ │ Product List / Button         │ │ Actions               │
│ Text / Image     │ │                               │ │ Visibility            │
│ Form / Input     │ └───────────────────────────────┘ │ Data source           │
│ [+ Component]    │                                   │                       │
├──────────────────┴───────────────────────────────────┴───────────────────────┤
│ [Actions/Blueprint] [Data Collections] [Errors]                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Мобильная версия:** полноэкранный прототип страницы; вкладки «Страницы», «Элементы», «Свойства», «Данные», «Действия». Выделение компонента tap по рамке, перестановка в компонентном дереве; drag по узким сеткам не является единственным способом верстки. Ширина Canvas переключается на фиксированные preview sizes, но сохраненная schema всегда responsive.

## 7. Blueprint Editor

ПК: слева поиск/категории, центр — бесконечный zoomable canvas, справа — параметры выделенного узла, снизу — runtime console. Цвет портов различается по типу, но тип дублируется текстом/формой. Есть Validate button и topological/loop диагностика. Версия графа — часть project revision.

Телефон: полный экран и крупный action FAB; long-press узла = действия (duplicate/delete/disable); связи можно создавать из меню «Соединить» с подсказкой допустимых целей. Зум не должен происходить при drag соединения. Для больших графов — jump-to-node и список ошибок.

## 8. Остальные экраны и обязательные пустые/ошибочные состояния

- **Dashboard:** состояния первый вход, пустая библиотека, сетевые ошибки, карточки последних проектов, кнопка `+ Создать`.
- **Wizard:** выбор режима → шаблон → имя/ориентация (для 2D/3D) → создание; ошибки формы и неповторимый slug.
- **Asset Manager:** drag & drop ПК, файловый picker в телефоне, проверка размера/типа, progress, preview, отмена и повтор.
- **Publish:** четкие стадии `Validate → Build Snapshot → Publish → Share`, ошибки с переходом в объект/граф; кнопка повторной публикации.
- **Versions:** time/revision, author, список значимых изменений; rollback создает **новый** draft revision, не переписывает историю.
- **Settings:** приватность, настройки рендера, snap, locale, лимиты, экспорт/удаление данных.
- **Offline:** `Изменения на устройстве` и `Сохранено в облаке` не смешиваются; при разрыве не показывать ложный статус «Сохранено».

## 9. Дизайн-система и адаптивность

Design tokens (направление «Мастерская»: тёплый графит, один сигнальный цвет, чертёжная сетка точек на «холстах»): bg `#0E0E0C`, sidebar `#151513`, surface `#1C1C19`, border `#33322C`, ink `#F3F1EA`, muted `#A6A398`, accent `#D4F24A` (заливка кнопки с ink `#12130B`), success `#5AD7AE`, warning `#F5B544`, destructive `#FF7A6B`. Светлая тема — «бумага» `#F3F1EA`; лайм на светлом фоне не держит контраст, поэтому primary — чёрная заливка `#191A14` с лаймовым текстом, акцент-текст `#4D6600`. Шрифты: Unbounded (заголовки), Onest (текст), JetBrains Mono (метки/метаданные) — все с кириллицей, self-hosted. Цвет — ориентир; контраст всех пар текст/поверхность ≥ 4.5:1 проверяется тестом ui-kit. Motion: 140/220/320 ms, ease-out, только transform/opacity, stagger ≤ 40 ms × 8. Type scale 12/14/16/20/28 px. Spacing 4/8/12/16/24 px. Keyboard focus и reduced-motion. Breakpoints — ориентиры: `<768` compact, `768–1199` adaptive, `≥1200` full desktop; плюс проверка touch pointer. На планшете разрешена двухпанельная схема. Смена темы Telegram не должна ломать читаемость Canvas.

## 10. UX-критерии приемки

1. Один и тот же проект открывается с телефона и ПК и дает одну scene hierarchy.
2. Ни одна базовая операция (создать/передвинуть/отменить/сохранить/Play/Publish) не требует аппаратной клавиатуры.
3. На телефоне все диалоги видны над системной клавиатурой, над safe areas и телеграм-панелями.
4. Пользователь может выйти из Play и попасть в точку редактирования без изменений черновика.
5. В любой момент отображается честный статус `Saving / Saved / Offline / Conflict`.
6. Publish нельзя объявить успешным до ответа сервера и доступности Player.
