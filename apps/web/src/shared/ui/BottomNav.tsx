import { haptics } from '../lib/haptics.js';
import { IconCreate, IconDiscover, IconProfile, IconSquad, IconTrophy } from './icons.js';

export type MainTab = 'discover' | 'create' | 'leaderboard' | 'squad' | 'profile';

const TABS: {
  id: MainTab;
  label: string;
  Icon: typeof IconDiscover;
}[] = [
  { id: 'discover', label: 'Рядом', Icon: IconDiscover },
  { id: 'create', label: 'Создать', Icon: IconCreate },
  { id: 'leaderboard', label: 'Топ', Icon: IconTrophy },
  { id: 'squad', label: 'Squad', Icon: IconSquad },
  { id: 'profile', label: 'Профиль', Icon: IconProfile },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: MainTab;
  onChange: (tab: MainTab) => void;
}) {
  const select = (tab: MainTab) => {
    if (tab !== active) {
      haptics.tap();
    }
    onChange(tab);
  };

  return (
    <nav
      aria-label="Главная навигация"
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-[max(1.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="glass-toolbar pointer-events-auto relative flex h-11 w-[calc(100%-3.5rem)] max-w-[19rem] items-center rounded-[20px] px-1">
        {TABS.map((tab) => {
          const isActive = active === tab.id;

          if (tab.id === 'create') {
            return (
              <div key={tab.id} className="relative z-[1] flex flex-1 items-center justify-center">
                <button
                  type="button"
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => select(tab.id)}
                  className={`gig-gradient-bg flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full text-white transition duration-200 active:scale-90 ${
                    isActive ? 'gig-glow-strong scale-105' : 'gig-glow'
                  }`}
                >
                  <tab.Icon className="h-6 w-6" strokeWidth={2.2} />
                </button>
              </div>
            );
          }

          return (
            <div key={tab.id} className="relative z-[1] flex flex-1 items-center justify-center">
              <button
                type="button"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => select(tab.id)}
                className={
                  isActive
                    ? 'nav-glow-node flex h-9 w-[68%] items-center justify-center rounded-[14px] transition duration-200'
                    : 'flex h-9 w-[68%] items-center justify-center rounded-[14px] transition duration-200 active:scale-95'
                }
                style={{ color: isActive ? 'var(--gig-tab-active-fg)' : 'var(--gig-tab-inactive)' }}
              >
                <tab.Icon
                  className={`h-[22px] w-[22px] transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
                  strokeWidth={isActive ? 2.1 : 1.8}
                />
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
