import { POINTS_INVITE_FRIEND } from '@game-is-game/shared';
import { useState } from 'react';

import { useInviteLink } from '../auth/invite.hooks.js';
import { useAuthStore } from '../auth/store.js';
import { useMyStreak } from '../social/hooks.js';
import { AnimatedNumber } from '../../shared/ui/motion.js';
import { IconSettings } from '../../shared/ui/icons.js';
import {
  Avatar,
  Card,
  GhostButton,
  SecondaryButton,
} from '../../shared/ui/primitives.js';

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
        <Avatar name={user.firstName} photoUrl={user.photoUrl} size="lg" />
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
          <p className="mt-2 text-sm font-medium text-gig-accent">
            {user.totalPoints} очков · {privacyLabel(user.privacyMode)}
          </p>
        </div>
      </div>

      <Card className="relative grid grid-cols-3 gap-3 overflow-hidden p-4">
        <span className="gig-gradient-soft-bg pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative text-center">
          <AnimatedNumber
            value={user.totalPoints}
            className="gig-gradient-text text-lg font-extrabold"
          />
          <p className="text-xs text-gig-muted">Очки</p>
        </div>
        <div className="relative text-center">
          <p className="text-lg font-bold text-gig-ink">
            {streak.data && streak.data.streakWeeks > 0 ? (
              <>
                <span className="gig-flame">🔥</span> {streak.data.streakWeeks}
              </>
            ) : (
              (streak.data?.streakWeeks ?? '—')
            )}
          </p>
          <p className="text-xs text-gig-muted">Стрик</p>
        </div>
        <div className="relative text-center">
          <p className="text-lg font-bold text-gig-ink">
            {streak.data ? (
              <>
                <span aria-hidden>🧊</span> {streak.data.freezeTokens}
              </>
            ) : (
              '—'
            )}
          </p>
          <p className="text-xs text-gig-muted">Заморозки</p>
        </div>
      </Card>

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

      <Card className="space-y-3 bg-gradient-to-br from-[var(--gig-card)] to-gig-surface/80">
        <div>
          <p className="font-semibold text-gig-ink">Пригласи друга</p>
          <p className="mt-1 text-sm text-gig-muted">
            +{POINTS_INVITE_FRIEND} очков, когда друг зайдёт по твоей ссылке.
          </p>
        </div>
        {invite.data ? (
          <>
            <p className="break-all rounded-2xl bg-gig-surface/80 px-3 py-2 text-xs text-gig-muted">
              {invite.data.miniAppUrl}
            </p>
            <GhostButton
              className="text-gig-accent"
              onClick={() => {
                void navigator.clipboard.writeText(invite.data.miniAppUrl).then(() => {
                  setInviteCopied(true);
                  setTimeout(() => setInviteCopied(false), 2000);
                });
              }}
            >
              {inviteCopied ? 'Ссылка скопирована' : 'Скопировать invite-ссылку'}
            </GhostButton>
          </>
        ) : (
          <p className="text-sm text-gig-muted">Загружаю ссылку…</p>
        )}
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-medium text-gig-muted">Мой ID для заявок в друзья</p>
        <p className="break-all font-mono text-xs text-gig-ink">{user.id}</p>
        <GhostButton className="text-gig-accent" onClick={() => void copyId()}>
          {copied ? 'Скопировано' : 'Скопировать'}
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
