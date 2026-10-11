import { useState } from 'react';

import {
  Card,
  Chip,
  ErrorBanner,
  GhostButton,
  PageTitle,
  PrimaryButton,
  TextInput,
} from '../../shared/ui/primitives.js';
import {
  useAcceptFriendRequest,
  useFriendRequests,
  useFriends,
  useLookupUser,
  useSendFriendRequest,
} from './hooks.js';

type AddMode = 'username' | 'id';

export function FriendsScreen({ onBack }: { onBack: () => void }) {
  const friends = useFriends();
  const requests = useFriendRequests();
  const send = useSendFriendRequest();
  const accept = useAcceptFriendRequest();

  const [addMode, setAddMode] = useState<AddMode>('username');
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const lookup = useLookupUser(username);

  return (
    <section className="space-y-5">
      <GhostButton onClick={onBack}>← Профиль</GhostButton>

      <PageTitle title="Друзья" subtitle="Друзья поднимают события в выдаче — «там будут свои»." />

      {requests.data && requests.data.items.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gig-ink">Входящие заявки</p>
          {requests.data.items.map((request) => (
            <Card key={request.id} className="flex items-center justify-between p-4">
              <span className="font-medium text-gig-ink">{request.requester.firstName}</span>
              <PrimaryButton
                className="px-4 py-2 text-sm"
                disabled={accept.isPending}
                onClick={() => accept.mutate(request.id)}
              >
                Принять
              </PrimaryButton>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <Chip active={addMode === 'username'} onClick={() => setAddMode('username')}>
            @username
          </Chip>
          <Chip active={addMode === 'id'} onClick={() => setAddMode('id')}>
            ID
          </Chip>
        </div>

        {addMode === 'username' ? (
          <>
            <TextInput
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
            />
            {lookup.data ? (
              <p className="text-sm text-gig-muted">
                Найден: {lookup.data.firstName}
                {lookup.data.username ? ` (@${lookup.data.username})` : ''}
              </p>
            ) : null}
            {lookup.isFetched && !lookup.data && username.length >= 3 ? (
              <p className="text-sm text-gig-muted">Пользователь не найден</p>
            ) : null}
            <PrimaryButton
              className="w-full"
              disabled={!lookup.data || send.isPending}
              onClick={() => {
                if (lookup.data) {
                  send.mutate({ userId: lookup.data.id }, { onSuccess: () => setUsername('') });
                }
              }}
            >
              {send.isPending ? 'Отправляю…' : 'Отправить заявку'}
            </PrimaryButton>
          </>
        ) : (
          <>
            <TextInput
              value={userId}
              onChange={(event) => setUserId(event.target.value.trim())}
              placeholder="clxxxxxxxx..."
              className="font-mono"
            />
            <PrimaryButton
              className="w-full"
              disabled={userId.length < 8 || send.isPending}
              onClick={() => send.mutate({ userId }, { onSuccess: () => setUserId('') })}
            >
              {send.isPending ? 'Отправляю…' : 'Отправить заявку'}
            </PrimaryButton>
          </>
        )}

        {send.error ? <ErrorBanner message={send.error.message} /> : null}
      </Card>

      {friends.isLoading ? <p className="text-sm text-gig-muted">Загружаю…</p> : null}
      {friends.data && friends.data.items.length === 0 ? (
        <p className="text-sm text-gig-muted">Пока никого — добавь первого друга.</p>
      ) : null}
      {friends.data && friends.data.items.length > 0 ? (
        <ul className="space-y-2">
          {friends.data.items.map((friend) => (
            <li key={friend.id}>
              <Card className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-gig-ink">{friend.firstName}</p>
                  {friend.username ? (
                    <p className="text-xs text-gig-muted">@{friend.username}</p>
                  ) : null}
                </div>
                <span className="text-sm text-gig-muted">{friend.totalPoints} очков</span>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
