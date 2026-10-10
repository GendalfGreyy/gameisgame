import { parseStudioGameStartParam } from '@game-is-game/shared';
import { useEffect, useState } from 'react';

import {
  useAutoTelegramAuth,
  useSessionBootstrap,
  useTelegramAuth,
} from './features/auth/hooks.js';
import { useAuthStore } from './features/auth/store.js';
import { StudioEditorScreen } from './features/studio/StudioEditorScreen.js';
import { StudioHubScreen } from './features/studio/StudioHubScreen.js';
import { StudioPlayScreen } from './features/studio/StudioPlayScreen.js';
import { getStartParam } from './shared/lib/telegram.js';
import { ErrorBanner, PrimaryButton } from './shared/ui/primitives.js';

type StudioStack =
  | { name: 'hub' }
  | { name: 'editor'; projectId: string }
  | { name: 'play'; projectId: string; preferPublished?: boolean };

/**
 * Standalone Creator Studio Mini App — no events/map/social chrome.
 * Enabled when VITE_STUDIO_ONLY=true at build time.
 */
export function StudioApp() {
  const user = useAuthStore((state) => state.user);
  const auth = useTelegramAuth();
  useSessionBootstrap();
  useAutoTelegramAuth();

  const [stack, setStack] = useState<StudioStack>({ name: 'hub' });

  useEffect(() => {
    if (!user) return;
    const gameId = parseStudioGameStartParam(getStartParam());
    if (gameId) {
      setStack({ name: 'play', projectId: gameId, preferPublished: true });
    }
  }, [user]);

  return (
    <div className="studio-app-shell mx-auto flex min-h-screen max-w-md flex-col">
      <main className="flex flex-1 flex-col gap-5 px-5 pb-10 pt-5">
        {!user ? (
          <section className="flex flex-1 flex-col justify-center gap-6 py-8">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7CFFCB]">
                Creator Studio
              </p>
              <h1 className="text-[34px] font-bold leading-tight tracking-tight text-gig-ink">
                Собери свою игру
              </h1>
              <p className="text-[15px] leading-relaxed text-gig-muted">
                Редактор сцены, Play и публикация прямо в Telegram — без карты и ивентов.
              </p>
            </div>
            <PrimaryButton
              className="w-full"
              onClick={() => auth.mutate()}
              disabled={auth.isPending}
            >
              {auth.isPending ? 'Подключаюсь…' : 'Войти через Telegram'}
            </PrimaryButton>
            {auth.error ? <ErrorBanner message={auth.error.message} /> : null}
          </section>
        ) : null}

        {user && stack.name === 'hub' ? (
          <StudioHubScreen
            onBack={() => undefined}
            hideBack
            onOpenProject={(projectId) => setStack({ name: 'editor', projectId })}
          />
        ) : null}

        {user && stack.name === 'editor' ? (
          <StudioEditorScreen
            projectId={stack.projectId}
            onBack={() => setStack({ name: 'hub' })}
            onPlay={() => setStack({ name: 'play', projectId: stack.projectId })}
          />
        ) : null}

        {user && stack.name === 'play' ? (
          <StudioPlayScreen
            projectId={stack.projectId}
            preferPublished={stack.preferPublished === true}
            onBack={() =>
              setStack(
                stack.preferPublished === true
                  ? { name: 'hub' }
                  : { name: 'editor', projectId: stack.projectId },
              )
            }
            onEdit={() => setStack({ name: 'editor', projectId: stack.projectId })}
          />
        ) : null}
      </main>
    </div>
  );
}
