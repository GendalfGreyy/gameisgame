import {
  activeScene,
  canRedo,
  canUndo,
  createEditorSession,
  getEntity,
  isDirty,
  presetsFor,
  saveIndicator,
  type EditorSession,
} from '@tg-creator/editor-core';
import { parseProjectDocument, type ProjectDocument, type Vec3 } from '@tg-creator/project-schema';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '../app/auth.js';
import { useToast } from '../app/toast.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { IconBack } from '../components/icons.js';
import { errorMessage } from '../lib/api.js';
import { goBack, navigate } from '../lib/router.js';
import { readStored, STORAGE_KEYS, writeStored } from '../lib/storage.js';
import { telegram } from '../lib/telegram.js';
import { addEntity, deleteEntity, duplicateEntity } from './actions.js';
import {
  EditorUiContext,
  SessionContext,
  useEditorState,
  useEditorUi,
  useSession,
  type EditorTool,
  type EditorUi,
  type MobileSheet,
} from './context.js';
import { Hierarchy } from './Hierarchy.js';
import { Inspector } from './Inspector.js';
import { MovePicker } from './MovePicker.js';
import { AssetsPanel, ConsolePanel, LogicPanel } from './Panels.js';
import { saveDraft } from './save.js';
import { SaveStatus } from './SaveStatus.js';
import { Sheet } from './Sheet.js';
import { useEditorShortcuts } from './shortcuts.js';
import { Viewport } from './Viewport.js';
import './editor.css';

const DESKTOP_QUERY = '(min-width: 1024px)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    onChange();
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

type Loaded = {
  session: EditorSession;
  title: string;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unsupported'; title: string }
  | { status: 'ready'; loaded: Loaded };

export function EditorScreen({ projectId }: { projectId: string }) {
  const { withSession } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    withSession((api) => api.getDraft(projectId))
      .then((draft) => {
        if (cancelled) {
          return;
        }
        const parsed = parseProjectDocument(draft.document);
        if (!parsed.ok) {
          setState({
            status: 'error',
            message: `Черновик не прошёл проверку (${parsed.code}). Откройте проект заново.`,
          });
          return;
        }
        if (parsed.document.type === 'app') {
          setState({ status: 'unsupported', title: parsed.document.title });
          return;
        }
        writeStored(STORAGE_KEYS.lastProject, projectId);
        setState({
          status: 'ready',
          loaded: {
            title: parsed.document.title,
            session: createEditorSession({
              document: parsed.document,
              revision: draft.revision,
              savedAt: draft.savedAt,
            }),
          },
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: errorMessage(error) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, withSession]);

  if (state.status === 'loading') {
    return (
      <div className="ed-state" aria-busy="true">
        <p className="muted">Открываем редактор…</p>
      </div>
    );
  }
  if (state.status !== 'ready') {
    return (
      <div className="ed-state">
        <h1 className="state__title">
          {state.status === 'unsupported' ? state.title : 'Не удалось открыть редактор'}
        </h1>
        <p className="muted">
          {state.status === 'unsupported'
            ? 'Конструктор приложений появится на этапе G9. Сейчас редактор работает со сценами 3D и 2D игр.'
            : state.message}
        </p>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => navigate({ name: 'project', projectId }, { replace: true })}
        >
          К проекту
        </button>
      </div>
    );
  }
  return (
    <SessionContext.Provider value={state.loaded.session}>
      <Workspace projectId={projectId} />
    </SessionContext.Provider>
  );
}

type BottomTab = 'assets' | 'logic' | 'console';
const BOTTOM_KEY = 'tgc.editor.bottom';

function readBottom(): { tab: BottomTab; open: boolean } {
  const [tab, open] = (readStored(BOTTOM_KEY) ?? 'console:1').split(':');
  return {
    tab: tab === 'assets' || tab === 'logic' ? tab : 'console',
    open: open !== '0',
  };
}

function Workspace({ projectId }: { projectId: string }) {
  const session = useSession();
  const { withSession } = useAuth();
  const { notify } = useToast();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [tool, setTool] = useState<EditorTool>('move');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<MobileSheet | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  const placementRef = useRef<Vec3>([0, 0.5, 0]);

  const dirty = useEditorState(isDirty);

  const save = useCallback(() => {
    void saveDraft(session, withSession, projectId);
  }, [session, withSession, projectId]);

  const requestDelete = useCallback(
    (entityId: string) => {
      if (isDesktop) {
        deleteEntity(session, entityId);
      } else {
        setPendingDelete(entityId);
      }
    },
    [isDesktop, session],
  );

  const ui: EditorUi = useMemo(
    () => ({
      layout: isDesktop ? 'desktop' : 'mobile',
      tool,
      setTool,
      renamingId,
      setRenamingId,
      placementRef,
      requestDelete,
      openSheet: setSheet,
      requestMove: setMoving,
      focusSelection: () => setFocusToken((token) => token + 1),
      focusToken,
    }),
    [isDesktop, tool, renamingId, requestDelete, focusToken],
  );

  const leave = useCallback(() => {
    if (isDirty(session.getState())) {
      setLeaving(true);
    } else {
      goBack();
    }
  }, [session]);

  // Telegram BackButton: close the open sheet first, then leave (asking if unsaved).
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  useEffect(() => {
    const tg = telegram();
    tg.showBackButton();
    return tg.onBackButton(() => {
      if (sheetRef.current) {
        setSheet(null);
      } else {
        leave();
      }
    });
  }, [leave]);

  useEffect(() => {
    if (!dirty) {
      return undefined;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const shortcuts = useMemo(
    () => ({
      undo: () => session.undo(),
      redo: () => session.redo(),
      save,
      duplicate: () => {
        const id = session.getState().selection.at(-1);
        if (id) duplicateEntity(session, id);
      },
      remove: () => {
        const id = session.getState().selection.at(-1);
        if (id) requestDelete(id);
      },
      rename: () => {
        const id = session.getState().selection.at(-1);
        if (id) setRenamingId(id);
      },
      deselect: () => session.select([]),
      focus: () => setFocusToken((token) => token + 1),
      toolSelect: () => setTool('select'),
      toolMove: () => setTool('move'),
    }),
    [session, save, requestDelete],
  );
  useEditorShortcuts(isDesktop, shortcuts);

  const deleteTarget = useEditorState((state) => {
    const scene = activeScene(state);
    return pendingDelete && scene ? getEntity(scene, pendingDelete) : undefined;
  });

  return (
    <EditorUiContext.Provider value={ui}>
      <div className={`ed ed--${isDesktop ? 'desktop' : 'mobile'}`} data-testid="editor">
        {isDesktop ? <DesktopLayout onBack={leave} onSave={save} /> : null}
        {!isDesktop ? <MobileLayout onBack={leave} onSave={save} sheet={sheet} /> : null}
      </div>
      {deleteTarget ? (
        <ConfirmDialog
          title={`Удалить «${deleteTarget.name}»?`}
          description={
            deleteTarget.childIds.length > 0
              ? 'Вложенные объекты тоже будут удалены. Действие можно отменить.'
              : 'Действие можно отменить кнопкой «Отменить».'
          }
          confirmLabel="Удалить"
          destructive
          onConfirm={() => {
            deleteEntity(session, deleteTarget.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
      {moving ? <MovePicker entityId={moving} onClose={() => setMoving(null)} /> : null}
      {leaving ? (
        <ConfirmDialog
          title="Выйти без сохранения?"
          description="Изменения после последнего сохранения не попадут в облако и пропадут."
          confirmLabel="Выйти без сохранения"
          destructive
          onConfirm={() => {
            setLeaving(false);
            notify('Изменения не сохранены');
            goBack();
          }}
          onCancel={() => setLeaving(false)}
        />
      ) : null}
    </EditorUiContext.Provider>
  );
}

function HistoryButtons() {
  const session = useSession();
  const undoEntry = useEditorState((state) => state.past.at(-1));
  const redoEntry = useEditorState((state) => state.future.at(-1));
  const undoable = useEditorState(canUndo);
  const redoable = useEditorState(canRedo);
  return (
    <div className="ed-group" role="group" aria-label="История">
      <button
        type="button"
        className="ed-tool"
        disabled={!undoable}
        title={undoEntry ? `Отменить: ${undoEntry.label} (Ctrl+Z)` : 'Нечего отменять'}
        aria-label="Отменить"
        onClick={() => session.undo()}
      >
        ↶<span className="ed-tool__text">Отменить</span>
      </button>
      <button
        type="button"
        className="ed-tool"
        disabled={!redoable}
        title={redoEntry ? `Повторить: ${redoEntry.label} (Ctrl+Shift+Z)` : 'Нечего повторять'}
        aria-label="Повторить"
        onClick={() => session.redo()}
      >
        ↷<span className="ed-tool__text">Повторить</span>
      </button>
    </div>
  );
}

function ToolButtons() {
  const ui = useEditorUi();
  const tools: { id: EditorTool; label: string; key: string }[] = [
    { id: 'select', label: 'Выбор', key: 'Q' },
    { id: 'move', label: 'Перемещение', key: 'W' },
  ];
  return (
    <div className="segmented ed-tools" role="radiogroup" aria-label="Инструмент">
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          role="radio"
          aria-checked={ui.tool === tool.id}
          className={`segmented__item${ui.tool === tool.id ? ' is-active' : ''}`}
          title={ui.layout === 'desktop' ? `${tool.label} (${tool.key})` : undefined}
          onClick={() => ui.setTool(tool.id)}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}

/** Save is shown only when there is something to send (no fake Save button). */
function SaveButton({ onSave, compact = false }: { onSave: () => void; compact?: boolean }) {
  const indicator = useEditorState(saveIndicator);
  if (indicator !== 'dirty' && indicator !== 'error' && indicator !== 'offline') {
    return null;
  }
  return (
    <button type="button" className="btn btn--primary btn--small" onClick={onSave} title="Ctrl+S">
      {indicator === 'dirty' ? 'Сохранить' : compact ? 'Повторить' : 'Повторить сохранение'}
    </button>
  );
}

function ConflictBanner({ projectId }: { projectId: string }) {
  const session = useSession();
  const { withSession } = useAuth();
  const { notify } = useToast();
  const save = useEditorState((state) => state.save);
  const [confirmReload, setConfirmReload] = useState(false);
  const [busy, setBusy] = useState(false);
  if (save.kind !== 'conflict') {
    return null;
  }

  const reload = async () => {
    setBusy(true);
    try {
      const draft = await withSession((api) => api.getDraft(projectId));
      const parsed = parseProjectDocument(draft.document);
      if (!parsed.ok) {
        throw new Error(parsed.code);
      }
      session.reset(parsed.document, draft.revision, draft.savedAt);
      notify('Загружена версия с сервера');
    } catch (error) {
      notify(errorMessage(error), 'error');
    } finally {
      setBusy(false);
      setConfirmReload(false);
    }
  };

  const saveAsCopy = async () => {
    setBusy(true);
    const local: ProjectDocument = session.getState().document;
    try {
      const created = await withSession((api) =>
        api.createProject({
          title: `${local.title} (копия)`.slice(0, 120),
          type: local.type,
          templateId: 'empty',
          orientation: local.settings.orientation,
        }),
      );
      await withSession((api) =>
        api.saveDraft(created.projectId, {
          baseRevision: created.revision,
          mutationId: session.ids('mut'),
          document: { ...local, id: created.projectId, title: created.project.title },
        }),
      );
      notify('Ваша версия сохранена отдельным проектом');
      navigate({ name: 'editor', projectId: created.projectId }, { replace: true });
    } catch (error) {
      notify(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ed-banner" role="alert" data-testid="conflict-banner">
      <p>
        Проект изменён в другом месте
        {save.actualRevision !== null ? ` (ревизия ${save.actualRevision})` : ''}. Ваши изменения не
        сохранены и не будут затёрты молча.
      </p>
      <div className="ed-banner__actions">
        <button
          type="button"
          className="btn btn--secondary btn--small"
          disabled={busy}
          onClick={() => setConfirmReload(true)}
        >
          Загрузить версию с сервера
        </button>
        <button
          type="button"
          className="btn btn--primary btn--small"
          disabled={busy}
          onClick={() => void saveAsCopy()}
        >
          Сохранить мою как копию
        </button>
      </div>
      {confirmReload ? (
        <ConfirmDialog
          title="Загрузить версию с сервера?"
          description="Ваши несохранённые изменения в этом редакторе будут отброшены."
          confirmLabel="Загрузить"
          destructive
          busy={busy}
          onConfirm={() => void reload()}
          onCancel={() => setConfirmReload(false)}
        />
      ) : null}
    </div>
  );
}

function AddMenu({ onDone, inline = false }: { onDone?: () => void; inline?: boolean }) {
  const session = useSession();
  const ui = useEditorUi();
  const projectType = useEditorState((state) => state.document.type);
  return (
    <div className={inline ? 'ed-add-grid' : 'ed-menu'} role="menu" aria-label="Добавить объект">
      {presetsFor(projectType).map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="menuitem"
          className={inline ? 'ed-add-grid__item' : undefined}
          onClick={() => {
            addEntity(session, preset.id, { position: ui.placementRef.current });
            onDone?.();
          }}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function ProjectTitle() {
  const title = useEditorState((state) => state.document.title);
  const sceneName = useEditorState((state) => activeScene(state)?.name ?? '');
  return (
    <div className="ed-title">
      <strong className="ed-title__name">{title}</strong>
      {sceneName ? <span className="ed-title__scene mono">{sceneName}</span> : null}
    </div>
  );
}

function DesktopLayout({ onBack, onSave }: { onBack: () => void; onSave: () => void }) {
  const [bottom, setBottom] = useState(readBottom);
  const [adding, setAdding] = useState(false);
  const projectId = useEditorState((state) => state.document.id);

  useEffect(() => {
    writeStored(BOTTOM_KEY, `${bottom.tab}:${bottom.open ? '1' : '0'}`);
  }, [bottom]);

  const tabs: { id: BottomTab; label: string; content: ReactNode }[] = [
    { id: 'assets', label: 'Ассеты', content: <AssetsPanel /> },
    { id: 'logic', label: 'Логика', content: <LogicPanel /> },
    { id: 'console', label: 'Консоль', content: <ConsolePanel /> },
  ];

  return (
    <>
      <header className="ed-toolbar">
        <button type="button" className="ed-icon-btn" aria-label="К проекту" onClick={onBack}>
          <IconBack />
        </button>
        <ProjectTitle />
        <HistoryButtons />
        <ToolButtons />
        <div className="ed-menu-anchor">
          <button
            type="button"
            className="btn btn--secondary btn--small"
            aria-expanded={adding}
            onClick={() => setAdding((open) => !open)}
          >
            + Объект
          </button>
          {adding ? <AddMenu onDone={() => setAdding(false)} /> : null}
        </div>
        <div className="ed-toolbar__end">
          <SaveStatus />
          <SaveButton onSave={onSave} />
        </div>
      </header>
      <ConflictBanner projectId={projectId} />
      <aside className="ed-pane ed-pane--left" aria-label="Иерархия">
        <h2 className="ed-pane__title">Иерархия</h2>
        <Hierarchy />
      </aside>
      <main className="ed-center">
        <Viewport />
      </main>
      <aside className="ed-pane ed-pane--right" aria-label="Инспектор">
        <h2 className="ed-pane__title">Инспектор</h2>
        <div className="ed-pane__scroll">
          <Inspector />
        </div>
      </aside>
      <section
        className={`ed-bottom${bottom.open ? '' : ' is-collapsed'}`}
        aria-label="Нижняя панель"
      >
        <div className="ed-bottom__tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={bottom.tab === tab.id}
              className={`ed-bottom__tab${bottom.tab === tab.id ? ' is-active' : ''}`}
              onClick={() => setBottom({ tab: tab.id, open: true })}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            className="ed-icon-btn ed-bottom__toggle"
            aria-label={bottom.open ? 'Свернуть панель' : 'Развернуть панель'}
            onClick={() => setBottom((value) => ({ ...value, open: !value.open }))}
          >
            {bottom.open ? '▾' : '▴'}
          </button>
        </div>
        {bottom.open ? (
          <div className="ed-bottom__body" role="tabpanel">
            {tabs.find((tab) => tab.id === bottom.tab)?.content}
          </div>
        ) : null}
      </section>
    </>
  );
}

function SelectionBar() {
  const session = useSession();
  const ui = useEditorUi();
  const entity = useEditorState((state) => {
    const scene = activeScene(state);
    const id = state.selection.at(-1);
    return scene && id ? getEntity(scene, id) : undefined;
  });
  if (!entity) {
    return (
      <div className="ed-mselect is-empty">
        <span className="muted">Коснитесь объекта, чтобы выбрать</span>
      </div>
    );
  }
  return (
    <div className="ed-mselect" data-testid="selection-bar">
      <span className="ed-mselect__name">{entity.name}</span>
      <button
        type="button"
        className="ed-icon-btn"
        aria-label="Дублировать"
        onClick={() => duplicateEntity(session, entity.id)}
      >
        ⧉
      </button>
      <button
        type="button"
        className="ed-icon-btn"
        aria-label="Удалить"
        onClick={() => ui.requestDelete(entity.id)}
      >
        🗑
      </button>
      <button
        type="button"
        className="btn btn--secondary btn--small"
        onClick={() => ui.openSheet('inspector')}
      >
        Свойства
      </button>
    </div>
  );
}

const SHEETS: { id: Exclude<MobileSheet, 'add'>; label: string; title: string }[] = [
  { id: 'hierarchy', label: 'Объекты', title: 'Объекты сцены' },
  { id: 'inspector', label: 'Свойства', title: 'Свойства' },
  { id: 'assets', label: 'Ассеты', title: 'Ассеты' },
  { id: 'logic', label: 'Логика', title: 'Логика' },
  { id: 'console', label: 'Консоль', title: 'Консоль' },
];

function MobileLayout({
  onBack,
  onSave,
  sheet,
}: {
  onBack: () => void;
  onSave: () => void;
  sheet: MobileSheet | null;
}) {
  const ui = useEditorUi();
  const projectId = useEditorState((state) => state.document.id);
  const close = () => ui.openSheet(null);
  const active = SHEETS.find((item) => item.id === sheet);

  return (
    <>
      <header className="ed-mtop">
        <button type="button" className="ed-icon-btn" aria-label="К проекту" onClick={onBack}>
          <IconBack />
        </button>
        <ProjectTitle />
        <SaveStatus compact />
        <HistoryButtons />
        <SaveButton onSave={onSave} compact />
      </header>
      <ConflictBanner projectId={projectId} />
      <main className="ed-mcanvas">
        <Viewport />
        <div className="ed-mcanvas__tools">
          <ToolButtons />
        </div>
        <button
          type="button"
          className="ed-fab"
          aria-label="Добавить объект"
          onClick={() => ui.openSheet('add')}
        >
          +
        </button>
      </main>
      <SelectionBar />
      <nav className="ed-mnav" aria-label="Панели редактора">
        {SHEETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ed-mnav__item${sheet === item.id ? ' is-active' : ''}`}
            aria-pressed={sheet === item.id}
            onClick={() => ui.openSheet(sheet === item.id ? null : item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {sheet === 'add' ? (
        <Sheet title="Добавить объект" onClose={close} testId="sheet-add">
          <AddMenu inline onDone={close} />
        </Sheet>
      ) : null}
      {active ? (
        <Sheet title={active.title} onClose={close} testId={`sheet-${active.id}`}>
          {active.id === 'hierarchy' ? <Hierarchy /> : null}
          {active.id === 'inspector' ? <Inspector /> : null}
          {active.id === 'assets' ? <AssetsPanel /> : null}
          {active.id === 'logic' ? <LogicPanel /> : null}
          {active.id === 'console' ? <ConsolePanel /> : null}
        </Sheet>
      ) : null}
    </>
  );
}
