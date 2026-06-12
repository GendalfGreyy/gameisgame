import { parseEventStartParam } from '@game-is-game/shared';
import { useEffect, useState } from 'react';

import { useAutoTelegramAuth, useSessionBootstrap, useTelegramAuth } from './features/auth/hooks.js';
import { useAuthStore } from './features/auth/store.js';
import { CreateEventScreen } from './features/events/CreateEventScreen.js';
import { DiscoveryScreen } from './features/events/DiscoveryScreen.js';
import { EventScreen } from './features/events/EventScreen.js';
import { FriendsScreen } from './features/friends/FriendsScreen.js';
import { ProfileScreen } from './features/profile/ProfileScreen.js';
import { SettingsScreen } from './features/profile/SettingsScreen.js';
import { HostQrScreen } from './features/host/HostQrScreen.js';
import { AdminScreen } from './features/moderation/AdminScreen.js';
import { isOnboardingComplete, OnboardingSheet } from './features/onboarding/OnboardingSheet.js';
import { LeaderboardScreen } from './features/social/LeaderboardScreen.js';
import { SquadScreen } from './features/social/SquadScreen.js';
import { getStartParam } from './shared/lib/telegram.js';
import { BottomNav, type MainTab } from './shared/ui/BottomNav.js';
import { ErrorBanner, PrimaryButton } from './shared/ui/primitives.js';

type StackScreen =
  | { name: 'event'; eventId: string }
  | { name: 'host-qr'; eventId: string }
  | { name: 'friends' }
  | { name: 'settings' }
  | { name: 'admin' };

export function App() {
  const user = useAuthStore((state) => state.user);
  const auth = useTelegramAuth();
  useSessionBootstrap();
  useAutoTelegramAuth();

  const [tab, setTab] = useState<MainTab>('discover');
  const [stack, setStack] = useState<StackScreen | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    if (user && isOnboardingComplete()) {
      setOnboardingDismissed(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const eventId = parseEventStartParam(getStartParam());
    if (eventId) {
      setStack({ name: 'event', eventId });
    }
  }, [user]);

  const showOnboarding = user !== null && !isOnboardingComplete() && !onboardingDismissed;

  const openEvent = (eventId: string) => {
    setStack({ name: 'event', eventId });
  };

  const showNav = user !== null && stack === null;

  return (
    <div className="app-radar-bg mx-auto flex min-h-screen max-w-md flex-col bg-tg-bg">
      {showOnboarding ? (
        <OnboardingSheet onDone={() => setOnboardingDismissed(true)} />
      ) : null}

      <main className="flex flex-1 flex-col gap-5 px-5 pb-24 pt-5">
        {!user ? (
          <section className="flex flex-1 flex-col justify-center gap-6 py-8">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gig-accent">
                Game is Game
              </p>
              <h1 className="text-[34px] font-bold leading-tight tracking-tight text-gig-ink">
                Где сейчас гейм?
              </h1>
              <p className="text-[15px] leading-relaxed text-gig-muted">
                События рядом, друзья на месте, очки за реальные чек-ины.
              </p>
            </div>
            <PrimaryButton
              className="w-full"
              onClick={() => {
                auth.mutate(undefined, {
                  onSuccess: () => {
                    if (!isOnboardingComplete()) {
                      setOnboardingDismissed(false);
                    }
                  },
                });
              }}
              disabled={auth.isPending}
            >
              {auth.isPending ? 'Подключаюсь…' : 'Войти через Telegram'}
            </PrimaryButton>
            {auth.error ? <ErrorBanner message={auth.error.message} /> : null}
          </section>
        ) : null}

        {user && stack === null && tab === 'discover' ? (
          <DiscoveryScreen user={user} onOpenEvent={openEvent} />
        ) : null}

        {user && stack === null && tab === 'create' ? (
          <CreateEventScreen onCreated={openEvent} />
        ) : null}

        {user && stack === null && tab === 'leaderboard' ? <LeaderboardScreen /> : null}

        {user && stack === null && tab === 'squad' ? <SquadScreen /> : null}

        {user && stack === null && tab === 'profile' ? (
          <ProfileScreen
            onOpenFriends={() => setStack({ name: 'friends' })}
            onOpenSettings={() => setStack({ name: 'settings' })}
            onOpenAdmin={() => setStack({ name: 'admin' })}
          />
        ) : null}

        {user && stack?.name === 'friends' ? (
          <FriendsScreen onBack={() => setStack(null)} />
        ) : null}

        {user && stack?.name === 'settings' ? (
          <SettingsScreen onBack={() => setStack(null)} />
        ) : null}

        {user && stack?.name === 'admin' ? (
          <AdminScreen onBack={() => setStack(null)} />
        ) : null}

        {user && stack?.name === 'event' ? (
          <EventScreen
            eventId={stack.eventId}
            onBack={() => setStack(null)}
            onOpenHostQr={(eventId) => setStack({ name: 'host-qr', eventId })}
            onCloned={(eventId) => setStack({ name: 'event', eventId })}
          />
        ) : null}

        {user && stack?.name === 'host-qr' ? (
          <HostQrScreen
            eventId={stack.eventId}
            onBack={() => setStack({ name: 'event', eventId: stack.eventId })}
          />
        ) : null}
      </main>

      {showNav ? <BottomNav active={tab} onChange={setTab} /> : null}
    </div>
  );
}
