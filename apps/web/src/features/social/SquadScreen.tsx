import { useState } from 'react';

import { haptics } from '../../shared/lib/haptics.js';
import { AnimatedNumber, Stagger } from '../../shared/ui/motion.js';
import {
  ErrorBanner,
  GhostButton,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from '../../shared/ui/primitives.js';
import { useCreateSquad, useJoinSquad, useLeaveSquad, useMySquad } from './hooks.js';

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        haptics.tap();
        void navigator.clipboard.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      className={`mx-auto block text-sm font-bold transition ${copied ? 'text-emerald-400' : 'gig-gradient-text'}`}
    >
      {copied ? '✓ Скопировано' : 'Скопировать код'}
    </button>
  );
}

export function SquadScreen() {
  const squad = useMySquad();
  const create = useCreateSquad();
  const join = useJoinSquad();
  const leave = useLeaveSquad();

  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  if (squad.isLoading) {
    return <p className="text-sm text-gig-muted">Загружаю squad…</p>;
  }

  if (squad.error) {
    return <ErrorBanner message={squad.error.message} />;
  }

  if (squad.data) {
    const detail = squad.data;
    const topPoints = Math.max(...detail.members.map((member) => member.totalPoints), 0);

    return (
      <section className="space-y-5">
        <div className="space-y-1">
          <PageTitle title={detail.name} />
          <p className="text-sm text-gig-muted">
            Private squad · {detail.memberCount}{' '}
            {detail.memberCount === 1 ? 'участник' : 'участников'} ·{' '}
            <span className="font-signal-mono font-bold text-gig-accent">
              {detail.weeklyPoints}
            </span>{' '}
            за неделю
          </p>
        </div>

        {/* Access key — hero block */}
        <div className="signal-card animate-fade-up p-5">
          <div className="relative space-y-4">
            <p className="settings-section-label">Access code</p>
            <div className="flex flex-wrap justify-center gap-2">
              {detail.inviteCode.split('').map((char, index) => (
                <span
                  key={`${char}-${index}`}
                  className="code-tile animate-pop"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  {char}
                </span>
              ))}
            </div>
            <CopyCodeButton code={detail.inviteCode} />
            <p className="text-center text-xs text-gig-muted">
              В групповом чате: <span className="font-signal-mono">/squad {detail.inviteCode}</span>
            </p>
          </div>
        </div>

        {/* Player cards */}
        <ul className="space-y-2">
          {detail.members.map((member, index) => {
            const isLeader = member.totalPoints === topPoints && topPoints > 0;
            return (
              <Stagger key={member.id} index={index}>
                <li>
                  <div
                    className={`signal-card flex items-center justify-between p-4 ${isLeader ? 'gig-glow' : ''}`}
                  >
                    <div className="relative flex items-center gap-3">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                          isLeader ? 'gig-gradient-bg text-white' : 'bg-gig-surface text-gig-muted'
                        }`}
                      >
                        {member.firstName.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-gig-ink">{member.firstName}</p>
                        {isLeader ? (
                          <p className="gig-gradient-text text-[11px] font-bold uppercase tracking-wide">
                            top signal
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="font-signal-mono relative rounded-full bg-gig-surface px-3 py-1 text-sm font-bold text-gig-accent">
                      <AnimatedNumber value={member.totalPoints} />
                    </span>
                  </div>
                </li>
              </Stagger>
            );
          })}
        </ul>

        <GhostButton
          className="w-full text-center text-red-400"
          disabled={leave.isPending}
          onClick={() => {
            haptics.press();
            leave.mutate();
          }}
        >
          {leave.isPending ? 'Выход…' : 'Покинуть squad'}
        </GhostButton>
        {leave.error ? <ErrorBanner message={leave.error.message} /> : null}
      </section>
    );
  }

  if (mode === 'create') {
    return (
      <section className="space-y-5">
        <GhostButton onClick={() => setMode(null)}>← Назад</GhostButton>
        <PageTitle title="Новый squad" subtitle="Команда 3–8 человек." />
        <label className="block space-y-2">
          <span className="text-sm font-medium text-gig-muted">Название (3–32 символа)</span>
          <TextInput value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <PrimaryButton
          className="w-full"
          disabled={name.trim().length < 3 || create.isPending}
          onClick={() => create.mutate({ name: name.trim() }, { onSuccess: () => setMode(null) })}
        >
          {create.isPending ? 'Создаю…' : 'Создать'}
        </PrimaryButton>
        {create.error ? <ErrorBanner message={create.error.message} /> : null}
      </section>
    );
  }

  if (mode === 'join') {
    return (
      <section className="space-y-5">
        <GhostButton onClick={() => setMode(null)}>← Назад</GhostButton>
        <PageTitle title="Вступить в squad" subtitle="Введи код от друга." />
        <label className="block space-y-2">
          <span className="text-sm font-medium text-gig-muted">Инвайт-код</span>
          <TextInput
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            className="font-mono uppercase"
          />
        </label>
        <PrimaryButton
          className="w-full"
          disabled={inviteCode.trim().length < 6 || join.isPending}
          onClick={() =>
            join.mutate({ inviteCode: inviteCode.trim() }, { onSuccess: () => setMode(null) })
          }
        >
          {join.isPending ? 'Вступаю…' : 'Вступить'}
        </PrimaryButton>
        {join.error ? <ErrorBanner message={join.error.message} /> : null}
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <PageTitle
        title="My Squad"
        subtitle="Команда 3–8 человек, общий счёт и недельный лидерборд."
      />
      <PrimaryButton className="w-full" onClick={() => setMode('create')}>
        Создать squad
      </PrimaryButton>
      <SecondaryButton className="w-full" onClick={() => setMode('join')}>
        Вступить по коду
      </SecondaryButton>
    </section>
  );
}
