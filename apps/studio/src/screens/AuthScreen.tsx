import { useState } from 'react';

import { DEV_AUTH_UI, useAuth, type AuthState } from '../app/auth.js';
import { Brand, BrandMark } from '../components/Brand.js';
import { telegram } from '../lib/telegram.js';

const DEV_USERS = [
  { id: '100000001', label: 'Тестовый пользователь A' },
  { id: '100000002', label: 'Тестовый пользователь B' },
];

function Loader() {
  return (
    <div className="fullscreen blueprint" data-testid="auth-loading" aria-busy="true">
      <span className="loader-mark">
        <BrandMark size={56} />
      </span>
      <p className="muted mono small">Входим через Telegram…</p>
    </div>
  );
}

/** S01: loader, auth errors and the signed-out states. */
export function AuthScreen({ state }: { state: Exclude<AuthState, { status: 'ready' }> }) {
  const { retry, loginDev } = useAuth();
  const [devUser, setDevUser] = useState(DEV_USERS[0]?.id ?? '100000001');
  const inTelegram = telegram().isTelegram;

  if (state.status === 'loading') {
    return <Loader />;
  }

  const title =
    state.status === 'error'
      ? 'Не удалось войти'
      : state.reason === 'loggedOut'
        ? 'Вы вышли из аккаунта'
        : state.reason === 'expired'
          ? 'Сессия истекла'
          : 'Откройте приложение в Telegram';

  const text =
    state.status === 'error'
      ? state.message
      : inTelegram
        ? 'Нажмите «Войти», чтобы продолжить работу с проектами.'
        : 'Вход выполняется через подписанные данные Telegram. Откройте Creator Studio из меню бота.';

  return (
    <div className="fullscreen blueprint" data-testid="auth-screen">
      <div className="auth-card enter">
        <Brand large />
        <p className="kicker">3D · 2D · приложения</p>
        <h1 className="auth-card__title">{title}</h1>
        <p className="muted">{text}</p>

        {(inTelegram || state.status === 'error') && (
          <button type="button" className="btn btn--primary btn--block" onClick={retry}>
            {state.status === 'error' ? 'Повторить' : 'Войти'}
          </button>
        )}

        {!inTelegram && DEV_AUTH_UI && (
          <div className="dev-auth">
            <p className="dev-auth__label mono">Режим разработки</p>
            <div className="segmented" role="radiogroup" aria-label="Тестовый пользователь">
              {DEV_USERS.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  role="radio"
                  aria-checked={devUser === user.id}
                  className={`segmented__item${devUser === user.id ? ' is-active' : ''}`}
                  onClick={() => setDevUser(user.id)}
                >
                  {user.label.replace('Тестовый пользователь ', 'Пользователь ')}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--block"
              data-testid="dev-login"
              onClick={() => void loginDev(devUser)}
            >
              Войти как тестовый пользователь
            </button>
            <p className="hint">Доступно только при NODE_ENV=development на сервере.</p>
          </div>
        )}
      </div>
    </div>
  );
}
