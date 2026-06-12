import { PrimaryButton } from '../../shared/ui/primitives.js';

const STORAGE_KEY = 'gig.onboarding.v1';

export function isOnboardingComplete(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === '1';
}

export function markOnboardingComplete(): void {
  sessionStorage.setItem(STORAGE_KEY, '1');
}

export function OnboardingSheet({ onDone }: { onDone: () => void }) {
  const finish = () => {
    markOnboardingComplete();
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-4xl border border-black/[0.06] bg-white p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gig-accent">
          Добро пожаловать
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-gig-ink">Game is Game</h2>

        <ul className="mt-5 space-y-4 text-sm leading-relaxed text-gig-muted">
          <li>
            <span className="font-semibold text-gig-ink">Рядом</span> — события вокруг тебя на карте и
            в списке.
          </li>
          <li>
            <span className="font-semibold text-gig-ink">Чек-ин</span> — только на месте: код хоста
            или 10 минут в геозоне. Очки — за реальное присутствие.
          </li>
          <li>
            <span className="font-semibold text-gig-ink">Друзья</span> — события с друзьями выше в
            ленте.
          </li>
          <li>
            <span className="font-semibold text-gig-ink">Приватность</span> — по умолчанию видимость
            ограничена.
          </li>
        </ul>

        <p className="mt-4 text-xs text-gig-muted">
          Для «Рядом» нужен доступ к геолокации — только пока app открыт.
        </p>

        <PrimaryButton className="mt-6 w-full" onClick={finish}>
          Понятно, поехали
        </PrimaryButton>
      </div>
    </div>
  );
}
