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
        <p className="settings-section-label">Оформление</p>
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-[17px] font-bold text-gig-ink">Тёмная тема</p>
            <p className="mt-0.5 text-[15px] text-gig-muted">Комфортнее вечером и ночью</p>
          </div>
          <ThemeSwitch
            checked={theme === 'dark'}
            onChange={toggleTheme}
            label="Тёмная тема"
          />
        </Card>
      </div>

      <div className="space-y-3">
        <p className="settings-section-label">Режим локации</p>
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
                className={`flex items-center justify-between gap-3 p-5 transition ${
                  active ? 'border-[rgba(139,92,246,0.45)] ring-1 ring-[rgba(139,92,246,0.3)]' : ''
                }`}
              >
                <div>
                  <p className="text-[17px] font-bold text-gig-ink">{label.title}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-gig-muted">{label.hint}</p>
                </div>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                    active
                      ? 'gig-gradient-bg border-transparent text-white'
                      : 'border-[var(--gig-input-border)] text-transparent'
                  }`}
                  aria-hidden
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4}>
                    <path d="m3 8.5 3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Card>
            </button>
          );
        })}
      </div>

      {update.error ? <ErrorBanner message={update.error.message} /> : null}
    </section>
  );
}
