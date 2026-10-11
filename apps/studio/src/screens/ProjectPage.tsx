import { migrateToLatest, type ProjectDocument } from '@tg-creator/project-schema';
import type { ProjectDetail } from '@tg-creator/shared';
import { useEffect, useState } from 'react';

import { useAuth } from '../app/auth.js';
import { useToast } from '../app/toast.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { IconBack, IconCopy, IconTrash } from '../components/icons.js';
import { TypeArt } from '../components/TypeArt.js';
import { errorMessage } from '../lib/api.js';
import { formatDateTime, projectTypeInfo } from '../lib/projectTypes.js';
import { goBack, navigate } from '../lib/router.js';
import { STORAGE_KEYS, writeStored } from '../lib/storage.js';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string; notFound: boolean }
  | { status: 'ready'; project: ProjectDetail; document: ProjectDocument | null };

function Structure({ document }: { document: ProjectDocument }) {
  if (document.type === 'app') {
    return (
      <ul className="tree" data-testid="project-structure">
        {document.pages.map((page) => (
          <li key={page.id}>
            <strong>Страница {page.route}</strong>
            <ul>
              {Object.values(page.components)
                .filter((component) => component.id !== page.rootComponentId)
                .map((component) => (
                  <li key={component.id}>
                    <span className="tree__meta mono">{component.type}</span>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    );
  }
  const scene =
    document.scenes.find((item) => item.id === document.entrySceneId) ?? document.scenes[0];
  if (!scene) {
    return <p className="muted">Сцен пока нет.</p>;
  }
  return (
    <ul className="tree" data-testid="project-structure">
      <li>
        <strong>{scene.name}</strong>
        <ul>
          {scene.rootEntityIds.map((entityId) => {
            const entity = scene.entities[entityId];
            return entity ? (
              <li key={entity.id}>
                <span className="tree__name">{entity.name}</span>
                <span className="tree__meta mono">
                  {entity.components.map((component) => component.type).join(' · ')}
                </span>
              </li>
            ) : null;
          })}
        </ul>
      </li>
    </ul>
  );
}

/** Project overview until the editor lands (G3–G4). Shows the real stored draft. */
export function ProjectPage({ projectId }: { projectId: string }) {
  const { withSession, refreshMe } = useAuth();
  const { notify } = useToast();
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    Promise.all([
      withSession((api) => api.getProject(projectId)),
      withSession((api) => api.getDraft(projectId)),
    ])
      .then(([project, draft]) => {
        if (cancelled) {
          return;
        }
        const migrated = migrateToLatest(draft.document);
        writeStored(STORAGE_KEYS.lastProject, project.id);
        setState({ status: 'ready', project, document: migrated.ok ? migrated.document : null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const notFound =
            typeof error === 'object' &&
            error !== null &&
            Reflect.get(error, 'code') === 'NOT_FOUND';
          setState({ status: 'error', message: errorMessage(error), notFound });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, withSession]);

  if (state.status === 'loading') {
    return (
      <div className="page" aria-busy="true">
        <div className="skeleton skeleton--title" />
        <div className="card card--skeleton">
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="page">
        <div className="state" role="alert">
          <h1 className="state__title">
            {state.notFound ? 'Проект не найден' : 'Не удалось открыть проект'}
          </h1>
          <p className="muted">
            {state.notFound ? 'Возможно, он удалён или принадлежит другому автору.' : state.message}
          </p>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate({ name: 'dashboard' }, { replace: true })}
          >
            К проектам
          </button>
        </div>
      </div>
    );
  }

  const { project, document } = state;
  const info = projectTypeInfo(project.type);

  const duplicate = async () => {
    setBusy(true);
    try {
      const copy = await withSession((api) => api.duplicateProject(project.id));
      void refreshMe().catch(() => undefined);
      notify('Копия создана');
      navigate({ name: 'project', projectId: copy.projectId });
    } catch (error) {
      notify(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await withSession((api) => api.deleteProject(project.id));
      writeStored(STORAGE_KEYS.lastProject, null);
      void refreshMe().catch(() => undefined);
      notify(`Проект «${project.title}» удалён`);
      navigate({ name: 'dashboard' }, { replace: true });
    } catch (error) {
      notify(errorMessage(error), 'error');
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="page" data-testid="project-page">
      <header className="page__header">
        <div className="page__header-main">
          <button
            type="button"
            className="icon-btn desktop-only"
            onClick={goBack}
            aria-label="Назад"
          >
            <IconBack />
          </button>
          <div className="page__heading">
            <p className="kicker">
              {info.label} · ревизия {project.revision}
            </p>
            <h1 className="page__title" data-testid="project-title">
              {project.title}
            </h1>
          </div>
        </div>
      </header>

      <div className="columns">
        <div className="stack">
          <section className="viewport blueprint enter" aria-label="Предпросмотр">
            <span className="viewport__label mono">Вьюпорт</span>
            <TypeArt type={project.type} className="viewport__art" />
            <div className="notice" role="note">
              <strong>Редактор в разработке</strong>
              <span>
                Сцена, иерархия и инспектор появятся на этапах G3–G4. Черновик уже сохранён на
                сервере — ниже его текущая структура.
              </span>
            </div>
          </section>
          <section className="card panel enter" style={{ '--i': 1 }}>
            <h2 className="panel__title">Структура черновика</h2>
            {document ? (
              <Structure document={document} />
            ) : (
              <p className="muted">Документ использует неподдерживаемую версию схемы.</p>
            )}
          </section>
        </div>
        <section className="card panel enter" style={{ '--i': 2 }}>
          <h2 className="panel__title">Сведения</h2>
          <dl className="facts">
            <dt>Создан</dt>
            <dd>{formatDateTime(project.createdAt)}</dd>
            <dt>Изменён</dt>
            <dd>{formatDateTime(project.lastEditedAt)}</dd>
            <dt>Ориентация</dt>
            <dd>
              {document?.settings.orientation === 'portrait'
                ? 'Портрет'
                : document?.settings.orientation === 'landscape'
                  ? 'Ландшафт'
                  : 'Авто'}
            </dd>
            <dt>Схема</dt>
            <dd>v{document?.schemaVersion ?? '—'}</dd>
          </dl>
          <div className="row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void duplicate()}
              disabled={busy}
            >
              <IconCopy size={16} />
              <span>Дублировать</span>
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--danger-text"
              onClick={() => setConfirming(true)}
              disabled={busy}
            >
              <IconTrash size={16} />
              <span>Удалить</span>
            </button>
          </div>
        </section>
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Удалить «${project.title}»?`}
          description="Проект пропадёт из списка. Это действие нельзя отменить из приложения."
          confirmLabel="Удалить"
          destructive
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
