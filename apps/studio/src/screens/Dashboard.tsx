import type { ProjectSummary, ProjectTypeDto } from '@tg-creator/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth, useMe } from '../app/auth.js';
import { useToast } from '../app/toast.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { IconArrow, IconCopy, IconPlus, IconSearch, IconTrash } from '../components/icons.js';
import { TypeArt } from '../components/TypeArt.js';
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

function SkeletonRows() {
  return (
    <div className="library" aria-hidden="true" data-testid="projects-skeleton">
      {[0, 1, 2].map((key) => (
        <div key={key} className="project-row project-row--skeleton">
          <div className="skeleton skeleton--thumb" />
          <div className="project-row__body">
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line skeleton--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Launchpad() {
  return (
    <section className="launchpad" aria-labelledby="launchpad-title">
      <h2 id="launchpad-title" className="kicker">
        Новый проект
      </h2>
      <div className="launchpad__grid">
        {PROJECT_TYPES.map((info, index) => (
          <button
            key={info.type}
            type="button"
            className={`launch-tile launch-tile--${info.type} enter`}
            style={{ '--i': index }}
            onClick={() => navigate({ name: 'wizard', type: info.type })}
            data-testid={`launch-${info.type}`}
          >
            <span className="launch-tile__art blueprint">
              <TypeArt type={info.type} />
            </span>
            <span className="launch-tile__label">
              {info.label}
              <IconArrow size={16} />
            </span>
            <span className="launch-tile__desc">{info.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function QuotaMeter({ used, limit }: { used: number; limit: number }) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  return (
    <div className="quota" title={`${used} из ${limit} проектов`}>
      <span className="quota__value mono">
        {used}
        <span className="muted">/{limit}</span>
      </span>
      <span
        className={`quota__bar${ratio >= 0.9 ? ' is-full' : ''}`}
        role="meter"
        aria-label="Проекты"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-valuetext={`${used} из ${limit} проектов`}
      >
        <span style={{ transform: `scaleX(${ratio})` }} />
      </span>
    </div>
  );
}

function ProjectRow({
  project,
  index,
  onDuplicate,
  onDelete,
  busy,
}: {
  project: ProjectSummary;
  index: number;
  onDuplicate: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const info = projectTypeInfo(project.type);
  const open = () => navigate({ name: 'project', projectId: project.id });
  return (
    <article
      className="project-row enter"
      style={{ '--i': Math.min(index, 8) }}
      data-testid="project-card"
    >
      <button type="button" className="project-row__open" onClick={open}>
        <span className={`thumb thumb--${project.type}`}>{info.icon(22)}</span>
        <span className="project-row__body">
          <span className="project-row__title">{project.title}</span>
          <span className="project-row__meta mono">
            <span className={`tag tag--${project.type}`}>{info.shortLabel}</span>
            <span>{formatDateTime(project.lastEditedAt)}</span>
          </span>
        </span>
        <span className="project-row__go" aria-hidden="true">
          <IconArrow size={18} />
        </span>
      </button>
      <div className="project-row__actions">
        <button
          type="button"
          className="icon-btn icon-btn--quiet"
          onClick={onDuplicate}
          disabled={busy}
          aria-label={`Дублировать «${project.title}»`}
          title="Дублировать"
        >
          <IconCopy size={18} />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--quiet icon-btn--danger"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Удалить «${project.title}»`}
          title="Удалить"
        >
          <IconTrash size={18} />
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
        <div className="page__heading">
          <p className="kicker">Студия</p>
          <h1 className="page__title">Мои проекты</h1>
        </div>
        <div className="page__header-side">
          <QuotaMeter used={used} limit={limit} />
          <button
            type="button"
            className="btn btn--primary"
            data-testid="create-project"
            onClick={() => navigate({ name: 'wizard' })}
          >
            <IconPlus size={18} />
            <span>Создать</span>
          </button>
        </div>
      </header>

      <Launchpad />

      {resume && (
        <button
          type="button"
          className="resume enter"
          onClick={() => navigate({ name: 'project', projectId: resume.id })}
        >
          <span className={`thumb thumb--${resume.type}`}>
            {projectTypeInfo(resume.type).icon(22)}
          </span>
          <span className="resume__body">
            <span className="kicker">Продолжить</span>
            <strong className="resume__title">{resume.title}</strong>
          </span>
          <IconArrow size={20} />
        </button>
      )}

      <div className="toolbar">
        <h2 className="section-title toolbar__title">Библиотека</h2>
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

      {state.status === 'loading' && <SkeletonRows />}

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
          <p className="muted">
            Выберите тип в блоке «Новый проект» — шаблон можно выбрать на следующем шаге.
          </p>
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
          <div className="library" data-testid="projects-grid">
            {state.items.map((project, index) => (
              <ProjectRow
                key={project.id}
                index={index}
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
