import { useState } from 'react';

import { useTelegramAuth } from './features/auth/hooks.js';
import { useAuthStore } from './features/auth/store.js';
import { DiscoveryScreen } from './features/events/DiscoveryScreen.js';
import { EventScreen } from './features/events/EventScreen.js';
import { HostQrScreen } from './features/host/HostQrScreen.js';

type Screen =
  | { name: 'discover' }
  | { name: 'event'; eventId: string }
  | { name: 'host-qr'; eventId: string };

export function App() {
  const user = useAuthStore((state) => state.user);
  const auth = useTelegramAuth();
  const [screen, setScreen] = useState<Screen>({ name: 'discover' });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-[0.2em] text-tg-accent">Game is Game</p>
        {user && screen.name === 'discover' ? (
          <p className="text-sm text-white/60">
            {user.firstName} · {user.totalPoints} очков
          </p>
        ) : null}
      </header>

      {!user ? (
        <>
          <section className="space-y-2">
            <h1 className="text-3xl font-semibold">Где сейчас гейм?</h1>
            <p className="text-sm text-white/70">
              События рядом, друзья на месте, очки за реальные чек-ины.
            </p>
          </section>
          <button
            type="button"
            onClick={() => auth.mutate()}
            disabled={auth.isPending}
            className="rounded-2xl bg-tg-accent px-4 py-3 text-base font-medium text-white disabled:opacity-60"
          >
            {auth.isPending ? 'Подключаюсь…' : 'Войти через Telegram'}
          </button>
          {auth.error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {auth.error.message}
            </p>
          ) : null}
        </>
      ) : null}

      {user && screen.name === 'discover' ? (
        <DiscoveryScreen onOpenEvent={(eventId) => setScreen({ name: 'event', eventId })} />
      ) : null}

      {user && screen.name === 'event' ? (
        <EventScreen
          eventId={screen.eventId}
          onBack={() => setScreen({ name: 'discover' })}
          onOpenHostQr={(eventId) => setScreen({ name: 'host-qr', eventId })}
        />
      ) : null}

      {user && screen.name === 'host-qr' ? (
        <HostQrScreen
          eventId={screen.eventId}
          onBack={() => setScreen({ name: 'event', eventId: screen.eventId })}
        />
      ) : null}
    </main>
  );
}
