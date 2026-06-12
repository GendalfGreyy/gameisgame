import type { PrivacyMode } from '@game-is-game/shared';
import { PRIVACY_MODES } from '@game-is-game/shared';

import { useAuthStore } from '../auth/store.js';
import { useUpdatePrivacyMode } from '../privacy/hooks.js';
import { useThemeStore } from '../../shared/lib/theme.js';
import { Card, ErrorBanner, GhostButton, PageTitle, ThemeSwitch } from '../../shared/ui/primitives.js';

const LABELS: Record<PrivacyMode, { title: string; hint: string }> = {
  precise: {
    title: 'Точная',
    hint: 'Друзья видят, что ты на событии (в рамках чек-ина).',
  },
  approximate: {
    title: 'Примерная',
    hint: 'Рекомендуем по умолчанию — район, не точка.',
  },
  hidden: {
    title: 'Скрыта',
    hint: 'Presence и списки участников скрыты; очки за чек-ин остаются.',
  },
};

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const user = useAuthStore((state) => state.user);
  const update = useUpdatePrivacyMode();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  if (!user) {
    return null;
  }

  return (
    <section className="space-y-5">
      <GhostButton onClick={onBack}>← Профиль</GhostButton>

      <PageTitle title="Настройки" subtitle="Приватность, тема и видимость." />

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gig-ink">Оформление</p>
        <Card className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="font-semibold text-gig-ink">Тёмная тема</p>
            <p className="mt-1 text-sm text-gig-muted">Комфортнее вечером и ночью</p>
          </div>
          <ThemeSwitch
            checked={theme === 'dark'}
            onChange={toggleTheme}
            label="Тёмная тема"
          />
        </Card>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gig-ink">Режим локации</p>
        {PRIVACY_MODES.map((mode) => {
          const active = user.privacyMode === mode;
          const label = LABELS[mode];
          return (
            <button
              key={mode}
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate(mode)}
              className="w-full text-left"
            >
              <Card
                className={
                  active
                    ? 'border-gig-accent/30 bg-gradient-to-br from-[var(--gig-card)] to-gig-accent/10 ring-2 ring-gig-accent/20'
                    : ''
                }
              >
                <p className="font-semibold text-gig-ink">{label.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-gig-muted">{label.hint}</p>
              </Card>
            </button>
          );
        })}
      </div>

      {update.error ? <ErrorBanner message={update.error.message} /> : null}
    </section>
  );
}
