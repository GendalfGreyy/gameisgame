import { useState } from 'react';

import { haptics } from '../../shared/lib/haptics.js';
import { AnimatedNumber, Skeleton, Stagger } from '../../shared/ui/motion.js';
import { Card, ErrorBanner, PageTitle, SegmentedControl } from '../../shared/ui/primitives.js';
import { useLeaderboard, useSquadLeaderboard } from './hooks.js';

type Tab = 'players' | 'squads';

type PodiumEntry = {
  key: string;
  name: string;
  points: number;
};

const PODIUM_STYLES = [
  { gradient: 'var(--gig-gold)', height: 'h-24', medal: '🥇', delay: '0ms' },
  { gradient: 'var(--gig-silver)', height: 'h-16', medal: '🥈', delay: '90ms' },
  { gradient: 'var(--gig-bronze)', height: 'h-12', medal: '🥉', delay: '180ms' },
] as const;

export function LeaderboardScreen() {
  const [tab, setTab] = useState<Tab>('players');
  const players = useLeaderboard();
  const squads = useSquadLeaderboard();

  const active = tab === 'players' ? players : squads;

  const podium: PodiumEntry[] =
    tab === 'players'
      ? (players.data?.items.slice(0, 3) ?? []).map((entry) => ({
          key: entry.userId,
          name: entry.firstName,
          points: entry.totalPoints,
        }))
      : (squads.data?.items.slice(0, 3) ?? []).map((entry) => ({
          key: entry.squadId,
          name: entry.name,
          points: entry.weeklyPoints,
        }));

  const rest =
    tab === 'players'
      ? (players.data?.items.slice(3) ?? []).map((entry) => ({
          key: entry.userId,
          rank: entry.rank,
          title: entry.firstName,
          subtitle: null as string | null,
          points: entry.totalPoints,
        }))
      : (squads.data?.items.slice(3) ?? []).map((entry) => ({
          key: entry.squadId,
          rank: entry.rank,
          title: entry.name,
          subtitle: `${entry.memberCount} чел.`,
          points: entry.weeklyPoints,
        }));

  const myRank = tab === 'players' ? players.data?.myRank : squads.data?.mySquadRank;

  return (
    <section className="space-y-5">
      <PageTitle
        title="Лидерборд"
        subtitle={tab === 'players' ? 'Все очки за всё время' : 'Squad за эту неделю'}
      />

      <SegmentedControl
        value={tab}
        onChange={(next) => {
          haptics.tap();
          setTab(next);
        }}
        options={[
          { value: 'players', label: 'Игроки' },
          { value: 'squads', label: 'Squads' },
        ]}
      />

      {active.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-14 w-full rounded-3xl" />
          <Skeleton className="h-14 w-full rounded-3xl" />
        </div>
      ) : null}
      {active.error ? <ErrorBanner message={active.error.message} /> : null}

      {podium.length > 0 ? <Podium entries={podium} /> : null}

      {rest.length > 0 ? (
        <ol className="space-y-2">
          {rest.map((entry, index) => (
            <Stagger key={entry.key} index={index}>
              <li>
                <Card className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gig-surface text-sm font-semibold text-gig-muted">
                      {entry.rank}
                    </span>
                    <div>
                      <span className="font-semibold text-gig-ink">{entry.title}</span>
                      {entry.subtitle ? (
                        <p className="text-xs text-gig-muted">{entry.subtitle}</p>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gig-accent">{entry.points}</span>
                </Card>
              </li>
            </Stagger>
          ))}
        </ol>
      ) : null}

      {myRank ? (
        <div className="animate-fade-up rounded-2xl py-1 text-center" style={{ animationDelay: '240ms' }}>
          <p className="text-sm text-gig-muted">
            {tab === 'players' ? 'Твоё место:' : 'Твой squad:'}{' '}
            <span className="gig-gradient-text font-extrabold">#{myRank}</span>
          </p>
        </div>
      ) : null}
    </section>
  );
}

/** Top-3 podium: 2nd — 1st — 3rd columns with metallic gradients. */
function Podium({ entries }: { entries: PodiumEntry[] }) {
  const order = [entries[1], entries[0], entries[2]];
  const styleOrder = [PODIUM_STYLES[1], PODIUM_STYLES[0], PODIUM_STYLES[2]];

  return (
    <div className="flex items-end justify-center gap-3 pt-2">
      {order.map((entry, column) => {
        if (!entry) {
          return <div key={`empty-${column}`} className="w-24" />;
        }
        const style = styleOrder[column] as (typeof PODIUM_STYLES)[number];
        const isFirst = column === 1;
        return (
          <div
            key={entry.key}
            className="animate-fade-up flex w-24 flex-col items-center gap-2"
            style={{ animationDelay: style.delay }}
          >
            <span className={`${isFirst ? 'animate-float text-4xl' : 'text-2xl'}`}>
              {style.medal}
            </span>
            <p className="w-full truncate text-center text-sm font-bold text-gig-ink">
              {entry.name}
            </p>
            <AnimatedNumber
              value={entry.points}
              className={`font-extrabold ${isFirst ? 'gig-gradient-text text-xl' : 'text-gig-accent text-sm'}`}
            />
            <div
              className={`${style.height} w-full rounded-t-2xl ${isFirst ? 'gig-glow' : ''}`}
              style={{ background: style.gradient }}
            />
          </div>
        );
      })}
    </div>
  );
}
