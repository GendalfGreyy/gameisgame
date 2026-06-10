import { useTelegramAuth } from './features/auth/hooks.js';
import { useAuthStore } from './features/auth/store.js';

export function App() {
  const user = useAuthStore((state) => state.user);
  const auth = useTelegramAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-tg-accent">Game is Game</p>
        <h1 className="text-3xl font-semibold">Nearby events, real check-ins</h1>
        <p className="text-sm text-white/70">
          Discover what is happening around you, join friends, and earn points.
        </p>
      </header>

      {user ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/60">Signed in as</p>
          <p className="text-lg font-medium">
            {user.firstName} {user.lastName ?? ''}
          </p>
          <p className="mt-2 text-sm text-white/70">{user.totalPoints} points</p>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => auth.mutate()}
          disabled={auth.isPending}
          className="rounded-2xl bg-tg-accent px-4 py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {auth.isPending ? 'Connecting…' : 'Continue with Telegram'}
        </button>
      )}

      {auth.error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {auth.error.message}
        </p>
      ) : null}
    </main>
  );
}
