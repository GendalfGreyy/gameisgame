import { POINTS_INVITE_FRIEND } from '@game-is-game/shared';
import { useState } from 'react';

import { useInviteLink } from '../auth/invite.hooks.js';
import { useAuthStore } from '../auth/store.js';
import { useMyStreak } from '../social/hooks.js';
import { AnimatedNumber } from '../../shared/ui/motion.js';
import { IconSettings } from '../../shared/ui/icons.js';
import { Avatar, Card, GhostButton, SecondaryButton } from '../../shared/ui/primitives.js';

export function ProfileScreen({
  onOpenFriends,
  onOpenSettings,
  onOpenAdmin,
}: {
  onOpenFriends: () => void;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const streak = useMyStreak();
  const invite = useInviteLink();
  const [copied, setCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  if (!user) {
    return null;
  }

  const isStaff = user.role === 'moderator' || user.role === 'admin';

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-start gap-4">
        <div className="avatar-ring shrink-0">
          <Avatar name={user.firstName} photoUrl={user.photoUrl} size="lg" />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold tracking-tight text-gig-ink">
                {user.firstName}
              </h2>
              {user.username ? (
                <p className="truncate text-sm text-gig-muted">@{user.username}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onOpenSettings}
              className="gig-card flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-card"
              aria-label="Настройки"
            >
              <IconSettings className="h-5 w-5 text-gig-ink" />
            </button>
          </div>
          <p className="mt-2 text-sm font-medium">
            <span className="font-signal-mono font-bold text-gig-accent">{user.totalPoints}</span>{' '}
            <span className="text-gig-accent">очков</span>
            <span className="text-gig-muted"> · {privacyLabel(user.privacyMode)}</span>
          </p>
        </div>
      </div>

      <div className="signal-card grid grid-cols-3 gap-2 p-4">
        <div className="relative space-y-0.5 text-center">
          <AnimatedNumber
            value={user.totalPoints}
            className="gig-gradient-text font-signal-mono text-xl font-extrabold"
          />
          <p className="settings-section-label">Signal</p>
        </div>
        <div className="relative space-y-0.5 border-x border-[var(--gig-divider)] text-center">
          <p className="font-signal-mono text-xl font-extrabold text-gig-ink">
            {streak.data && streak.data.streakWeeks > 0 ? (
              <>
                <span className="gig-flame text-base">🔥</span> {streak.data.streakWeeks}
              </>
            ) : (
              (streak.data?.streakWeeks ?? '—')
            )}
          </p>
          <p className="settings-section-label">Стрик</p>
        </div>
        <div className="relative space-y-0.5 text-center">
          <p className="font-signal-mono text-xl font-extrabold text-gig-ink">
            {streak.data ? (
              <>
                <span className="text-base" aria-hidden>
                  🧊
                </span>{' '}
                {streak.data.freezeTokens}
              </>
            ) : (
              '—'
            )}
          </p>
          <p className="settings-section-label">Фризы</p>
        </div>
      </div>

      <div className="flex gap-2">
        <SecondaryButton className="flex-1" onClick={onOpenFriends}>
          Друзья
        </SecondaryButton>
        <SecondaryButton className="flex-1" onClick={onOpenSettings}>
          Настройки
        </SecondaryButton>
      </div>

      {isStaff ? (
        <SecondaryButton className="w-full text-red-600" onClick={onOpenAdmin}>
          Модерация
        </SecondaryButton>
      ) : null}

      <div className="reward-card space-y-3 p-4">
        <div>
          <p className="settings-section-label">Reward</p>
          <p className="mt-1 font-semibold text-gig-ink">Пригласи друга</p>
          <p className="mt-1 text-sm text-gig-muted">
            <span className="gig-gradient-text font-signal-mono font-bold">
              +{POINTS_INVITE_FRIEND}
            </span>{' '}
            очков, когда друг зайдёт по твоей ссылке.
          </p>
        </div>
        {invite.data ? (
          <>
            <p className="font-signal-mono break-all rounded-2xl bg-gig-surface/80 px-3 py-2 text-xs text-gig-muted">
              {invite.data.miniAppUrl}
            </p>
            <GhostButton
              className={inviteCopied ? 'text-emerald-400' : 'gig-gradient-text font-bold'}
              onClick={() => {
                void navigator.clipboard.writeText(invite.data.miniAppUrl).then(() => {
                  setInviteCopied(true);
                  setTimeout(() => setInviteCopied(false), 2000);
                });
              }}
            >
              {inviteCopied ? '✓ Ссылка скопирована' : 'Скопировать invite-ссылку'}
            </GhostButton>
          </>
        ) : (
          <p className="text-sm text-gig-muted">Загружаю ссылку…</p>
        )}
      </div>

      <Card className="space-y-2">
        <p className="settings-section-label">ID для заявок в друзья</p>
        <p className="font-signal-mono break-all text-xs text-gig-ink">{user.id}</p>
        <GhostButton className="text-gig-accent" onClick={() => void copyId()}>
          {copied ? '✓ Скопировано' : 'Скопировать'}
        </GhostButton>
      </Card>
    </section>
  );
}

function privacyLabel(mode: string): string {
  switch (mode) {
    case 'precise':
      return 'точная локация';
    case 'approximate':
      return 'примерная локация';
    case 'hidden':
      return 'локация скрыта';
    default:
      return mode;
  }
}
