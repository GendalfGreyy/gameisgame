import { useState } from 'react';

import {
  Card,
  ErrorBanner,
  GhostButton,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from '../../shared/ui/primitives.js';
import { useCreateSquad, useJoinSquad, useLeaveSquad, useMySquad } from './hooks.js';

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
    return (
      <section className="space-y-5">
        <PageTitle
          title={detail.name}
          subtitle={`${detail.memberCount} участников · ${detail.weeklyPoints} очков за неделю`}
        />

        <Card className="space-y-2 bg-gradient-to-br from-white to-gig-accent/5">
          <p className="text-sm text-gig-muted">Инвайт-код для друзей</p>
          <p className="font-mono text-3xl font-bold tracking-[0.2em] text-gig-ink">
            {detail.inviteCode}
          </p>
          <p className="text-xs text-gig-muted">В групповом чате: /squad {detail.inviteCode}</p>
        </Card>

        <ul className="space-y-2">
          {detail.members.map((member) => (
            <li key={member.id}>
              <Card className="flex items-center justify-between p-4">
                <span className="font-medium text-gig-ink">{member.firstName}</span>
                <span className="text-sm text-gig-muted">{member.totalPoints} очков</span>
              </Card>
            </li>
          ))}
        </ul>

        <SecondaryButton
          className="w-full text-red-600"
          disabled={leave.isPending}
          onClick={() => leave.mutate()}
        >
          {leave.isPending ? 'Выход…' : 'Покинуть squad'}
        </SecondaryButton>
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
