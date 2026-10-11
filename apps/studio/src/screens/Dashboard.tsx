import type { ProjectSummary, ProjectTypeDto } from '@tg-creator/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth, useMe } from '../app/auth.js';
import { useToast } from '../app/toast.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { IconCopy, IconPlus, IconSearch, IconTrash } from '../components/icons.js';
import { errorMessage } from '../lib/api.js';
import { formatDateTime, PROJECT_TYPES, projectTypeInfo } from '../lib/projectTypes.js';
import { navigate } from '../lib/router.js';
import { readStored, STORAGE_KEYS } from '../lib/storage.js';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: ProjectSummary[]; nextCursor: string | null; loadingMore: boolean };

const FILTERS: ReadonlyArray<{ value: ProjectTypeDto | null; label: string }> = [
  { value: null, label: 'Все' },
  ...PROJECT_TYPES.map((info) => ({ value: info.type, label: info.shortLabel })),
];

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function SkeletonGrid() {
  return (
    <div className="grid" aria-hidden="true" data-testid="projects-skeleton">
      {[0, 1, 2].map((key) => (
        <div key={key} className="card card--skeleton">
          <div className="skeleton skeleton--icon" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      ))}
    </div>
  );
}

function ProjectCard({
  project,
  onDuplicate,
  onDelete,
  busy,
}: {
  project: ProjectSummary;
  onDuplicate: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const info = projectTypeInfo(project.type);
  const open = () => navigate({ name: 'project', projectId: project.id });
  return (
    <article className="card project-card" data-testid="project-card">
      <button type="button" className="project-card__main" onClick={open}>
        <span className={`type-icon type-icon--${project.type}`}>{info.icon(22)}</span>
        <span className="project-card__body">
          <span className="project-card__title">{project.title}</span>
          <span className="project-card__meta">
            {info.label} · изменён {formatDateTime(project.lastEditedAt)}
          </span>
        </span>
      </button>
      <div className="project-card__actions">
        <button type="button" className="btn btn--primary btn--small" onClick={open}>
          Открыть
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={onDuplicate}
          disabled={busy}
        >
          <IconCopy size={16} />
          <span>Дублировать</span>
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--small btn--danger-text"
          onClick={onDelete}
          disabled={busy}
        >
          <IconTrash size={16} />
          <span>Удалить</span>
        </button>
      </div>
    </article>
  );
}

/** S02: project library with search, type filter and Create/Resume/Duplicate/Delete. */
export function Dashboard() {
  const { withSession, refreshMe } = useAuth();
  const me = useMe();
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ProjectTypeDto | null>(null);
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);
  const debouncedQuery = useDebounced(query, 300);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    setState({ status: 'loading' });
    withSession((api) => api.listProjects({ type, q: debouncedQuery }))
      .then((page) => {
        if (id === requestId.current) {
          setState({
            status: 'ready',
            items: page.items,
            nextCursor: page.nextCursor,
            loadingMore: false,
          });
        }
      })
      .catch((error: unknown) => {
        if (id === requestId.current) {
          setState({ status: 'error', message: errorMessage(error) });
        }
      });
  }, [withSession, type, debouncedQuery, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
    void refreshMe().catch(() => undefined);
  }, [refreshMe]);

  const loadMore = async () => {
    if (state.status !== 'ready' || !state.nextCursor) {
      return;
    }
    const cursor = state.nextCursor;
    setState({ ...state, loadingMore: true });
    try {
      const page = await withSession((api) =>
        api.listProjects({ type, q: debouncedQuery, cursor }),
      );
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              items: [...current.items, ...page.items],
              nextCursor: page.nextCursor,
              loadingMore: false,
            }
          : current,
      );
    } catch (error) {
      notify(errorMessage(error), 'error');
      setState((current) =>
        current.status === 'ready' ? { ...current, loadingMore: false } : current,
      );
    }
  };

  const duplicate = async (project: ProjectSummary) => {
    setBusyId(project.id);
    try {
      await withSession((api) => api.duplicateProject(project.id));
      notify(`Создана копия «${project.title}»`);
      reload();
    } catch (error) {
      notify(errorMessage(error), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    const project = pendingDelete;
    setBusyId(project.id);
    try {
      await withSession((api) => api.deleteProject(project.id));
      notify(`Проект «${project.title}» удалён`);
      setPendingDelete(null);
      reload();
    } catch (error) {
      notify(errorMessage(error), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const filtersActive = type !== null || debouncedQuery.trim().length > 0;
  const lastProjectId = readStored(STORAGE_KEYS.lastProject);
  const resume =
    state.status === 'ready' && !filtersActive
      ? state.items.find((item) => item.id === lastProjectId)
      : undefined;
  const { used, limit } = me.quotas.projects;

  return (
    <div className="page" data-testid="dashboard">
      <header className="page__header">
        <div>
          <h1 className="page__title">Мои проекты</h1>
          <p className="muted small">
            {used} из {limit} проектов
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          data-testid="create-project"
          onClick={() => navigate({ name: 'wizard' })}
        >
          <IconPlus size={18} />
          <span>Создать</span>
        </button>
      </header>

      <div className="toolbar">
        <label className="search">
          <IconSearch size={18} />
          <input
            type="search"
            placeholder="Поиск по названию"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Поиск по названию"
            enterKeyHint="search"
          />
        </label>
        <div className="chips" role="radiogroup" aria-label="Тип проекта">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              role="radio"
              aria-checked={type === filter.value}
              className={`chip${type === filter.value ? ' is-active' : ''}`}
              onClick={() => setType(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {resume && (
        <button
          type="button"
          className="resume"
          onClick={() => navigate({ name: 'project', projectId: resume.id })}
        >
          <span className="muted small">Продолжить</span>
          <strong>{resume.title}</strong>
        </button>
      )}

      {state.status === 'loading' && <SkeletonGrid />}

      {state.status === 'error' && (
        <div className="state" role="alert" data-testid="projects-error">
          <h2 className="state__title">Не удалось загрузить проекты</h2>
          <p className="muted">{state.message}</p>
          <button type="button" className="btn btn--secondary" onClick={reload}>
            Повторить
          </button>
        </div>
      )}

      {state.status === 'ready' && state.items.length === 0 && !filtersActive && (
        <div className="state" data-testid="projects-empty">
          <h2 className="state__title">Здесь появятся ваши проекты</h2>
          <p className="muted">Начните с игры или приложения — шаблон можно выбрать дальше.</p>
          <div className="quick-start">
            {PROJECT_TYPES.map((info) => (
              <button
                key={info.type}
                type="button"
                className="quick-start__item"
                onClick={() => navigate({ name: 'wizard', type: info.type })}
              >
                <span className={`type-icon type-icon--${info.type}`}>{info.icon(22)}</span>
                <span>{info.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {state.status === 'ready' && state.items.length === 0 && filtersActive && (
        <div className="state">
          <h2 className="state__title">Ничего не найдено</h2>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setQuery('');
              setType(null);
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      )}

      {state.status === 'ready' && state.items.length > 0 && (
        <>
          <div className="grid" data-testid="projects-grid">
            {state.items.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                busy={busyId === project.id}
                onDuplicate={() => void duplicate(project)}
                onDelete={() => setPendingDelete(project)}
              />
            ))}
          </div>
          {state.nextCursor && (
            <div className="center">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void loadMore()}
                disabled={state.loadingMore}
              >
                {state.loadingMore ? 'Загрузка…' : 'Показать ещё'}
              </button>
            </div>
          )}
        </>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Удалить «${pendingDelete.title}»?`}
          description="Проект пропадёт из списка. Это действие нельзя отменить из приложения."
          confirmLabel="Удалить"
          destructive
          busy={busyId === pendingDelete.id}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
