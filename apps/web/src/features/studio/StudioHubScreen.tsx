import type { StudioTemplateId } from '@game-is-game/shared';
import { useState } from 'react';

import { haptics } from '../../shared/lib/haptics.js';
import {
  ErrorBanner,
  GhostButton,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
} from '../../shared/ui/primitives.js';
import { useCreateStudioProject, useDeleteStudioProject, useStudioProjects } from './hooks.js';

const TEMPLATES: { id: StudioTemplateId; title: string; blurb: string }[] = [
  { id: 'platformer', title: 'Платформер', blurb: 'Прыжки, монеты, финиш' },
  { id: 'collector', title: 'Сборщик', blurb: 'Вид сверху, собери всё' },
  { id: 'empty', title: 'Пустой мир', blurb: 'С нуля' },
];

export function StudioHubScreen({
  onOpenProject,
  onBack,
  hideBack = false,
}: {
  onOpenProject: (projectId: string) => void;
  onBack: () => void;
  /** Standalone studio Mini App has no parent screen. */
  hideBack?: boolean;
}) {
  const projects = useStudioProjects();
  const create = useCreateStudioProject();
  const remove = useDeleteStudioProject();
  const [title, setTitle] = useState('Моя игра');
  const [template, setTemplate] = useState<StudioTemplateId>('platformer');
  const [creating, setCreating] = useState(false);

  const onCreate = async () => {
    haptics.tap();
    const project = await create.mutateAsync({ title: title.trim() || 'Моя игра', template });
    setCreating(false);
    onOpenProject(project.id);
  };

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {!hideBack ? (
            <GhostButton onClick={onBack} className="mb-1">
              ← Назад
            </GhostButton>
          ) : null}
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gig-accent">
            Creator Studio
          </p>
          <h1 className="text-[28px] font-bold leading-tight text-gig-ink">Твои миры</h1>
          <p className="text-[14px] text-gig-muted">
            Собери сцену, нажми Play, опубликуй в Telegram.
          </p>
        </div>
      </header>

      {!creating ? (
        <PrimaryButton
          onClick={() => {
            haptics.tap();
            setCreating(true);
          }}
        >
          Новая игра
        </PrimaryButton>
      ) : (
        <div className="studio-panel space-y-4 rounded-3xl p-4">
          <label className="block space-y-2">
            <span className="text-xs font-medium text-gig-muted">Название</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={48}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[15px] text-gig-ink outline-none focus:border-gig-accent"
              placeholder="Название игры"
            />
          </label>
          <div className="space-y-2">
            <span className="text-xs font-medium text-gig-muted">Шаблон</span>
            <SegmentedControl
              value={template}
              onChange={setTemplate}
              options={TEMPLATES.map((t) => ({ value: t.id, label: t.title }))}
            />
            <p className="text-[13px] text-gig-muted">
              {TEMPLATES.find((t) => t.id === template)?.blurb}
            </p>
          </div>
          <div className="flex gap-2">
            <PrimaryButton
              className="flex-1"
              disabled={create.isPending}
              onClick={() => void onCreate()}
            >
              {create.isPending ? 'Создаю…' : 'Открыть редактор'}
            </PrimaryButton>
            <SecondaryButton onClick={() => setCreating(false)}>Отмена</SecondaryButton>
          </div>
          {create.error ? <ErrorBanner message={create.error.message} /> : null}
        </div>
      )}

      {projects.isLoading ? <p className="text-sm text-gig-muted">Загружаю проекты…</p> : null}
      {projects.error ? <ErrorBanner message={projects.error.message} /> : null}

      <ul className="flex flex-col gap-3">
        {(projects.data?.items ?? []).map((project) => (
          <li key={project.id}>
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenProject(project.id);
              }}
              className="studio-project-row flex w-full items-center gap-3 rounded-3xl p-3 text-left transition active:scale-[0.99]"
            >
              <span
                className="h-12 w-12 shrink-0 rounded-2xl"
                style={{
                  background: `linear-gradient(145deg, ${project.accentColor}, #0B1F2A)`,
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold text-gig-ink">
                  {project.title}
                </span>
                <span className="mt-0.5 block text-[12px] text-gig-muted">
                  {project.status === 'published' ? 'Опубликовано' : 'Черновик'} ·{' '}
                  {project.entityCount} объектов · {project.playCount} plays
                </span>
              </span>
              <span
                role="button"
                tabIndex={0}
                className="rounded-xl px-2 py-1 text-[12px] text-gig-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Удалить проект?')) {
                    void remove.mutateAsync(project.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    if (window.confirm('Удалить проект?')) {
                      void remove.mutateAsync(project.id);
                    }
                  }
                }}
              >
                ✕
              </span>
            </button>
          </li>
        ))}
      </ul>

      {!projects.isLoading && (projects.data?.items.length ?? 0) === 0 && !creating ? (
        <p className="rounded-3xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gig-muted">
          Пока пусто. Создай первую игру — как в Roblox, только прямо в Telegram.
        </p>
      ) : null}
    </section>
  );
}
