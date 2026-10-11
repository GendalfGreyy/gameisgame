import { PROJECT_SCHEMA_VERSION } from '@tg-creator/project-schema';
import type { UpdatePreferencesRequest } from '@tg-creator/shared';
import {
  resolveTheme,
  type Density,
  type ThemePreference,
  type ThemeTokens,
} from '@tg-creator/ui-kit';
import { useRef, useState } from 'react';

import { useAuth, useMe } from '../app/auth.js';
import { useTheme } from '../app/theme.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { IconCheck } from '../components/icons.js';
import { errorMessage } from '../lib/api.js';
import { formatDateTime } from '../lib/projectTypes.js';
import { telegram } from '../lib/telegram.js';

type SyncState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'failed'; message: string };

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; hint: string }> = [
  { value: 'telegram', label: 'Как в Telegram', hint: 'Цвета вашего клиента Telegram' },
  { value: 'system', label: 'Системная', hint: 'Светлая или тёмная, как в устройстве' },
  { value: 'dark', label: 'Тёмная', hint: 'Нейтральный тёмный интерфейс' },
  { value: 'light', label: 'Светлая', hint: 'Светлый интерфейс' },
];

const DENSITY_OPTIONS: ReadonlyArray<{ value: Density; label: string }> = [
  { value: 'comfortable', label: 'Удобный' },
  { value: 'compact', label: 'Компактный' },
];

function Swatch({ tokens }: { tokens: ThemeTokens }) {
  return (
    <span className="swatch" style={{ background: tokens.bg, borderColor: tokens.border }}>
      <span className="swatch__bar" style={{ background: tokens.sidebar }} />
      <span className="swatch__card" style={{ background: tokens.surface }}>
        <span className="swatch__line" style={{ background: tokens.ink }} />
        <span className="swatch__line swatch__line--short" style={{ background: tokens.muted }} />
        <span className="swatch__button" style={{ background: tokens.accentFill }} />
      </span>
    </span>
  );
}

function initials(firstName: string, lastName: string | null): string {
  return `${firstName.charAt(0)}${lastName?.charAt(0) ?? ''}`.toUpperCase() || '?';
}

/** S18 (G1 scope): appearance, account, session. Privacy/render/team settings come later. */
export function Settings() {
  const { withSession, logout } = useAuth();
  const me = useMe();
  const theme = useTheme();
  const [sync, setSync] = useState<SyncState>({ status: 'idle' });
  const [confirmLogout, setConfirmLogout] = useState(false);
  const saveSeq = useRef(0);
  const tg = telegram();

  const persist = async (patch: UpdatePreferencesRequest) => {
    const seq = ++saveSeq.current;
    setSync({ status: 'saving' });
    try {
      await withSession((api) => api.updatePreferences(patch));
      if (seq === saveSeq.current) {
        setSync({ status: 'saved' });
      }
    } catch (error) {
      if (seq === saveSeq.current) {
        setSync({ status: 'failed', message: errorMessage(error) });
      }
    }
  };

  const chooseTheme = (value: ThemePreference) => {
    theme.setPreference(value);
    void persist({ theme: value });
  };

  const chooseDensity = (value: Density) => {
    theme.setDensity(value);
    void persist({ density: value });
  };

  const sourceLabel =
    theme.resolved.source === 'telegram'
      ? 'палитра Telegram'
      : theme.resolved.source === 'system'
        ? 'тема устройства'
        : 'выбрано вручную';

  const { user, quotas, session } = me;

  return (
    <div className="page page--narrow" data-testid="settings">
      <header className="page__header">
        <div className="page__heading">
          <p className="kicker">Студия</p>
          <h1 className="page__title">Настройки</h1>
        </div>
      </header>

      <section
        className="card panel settings-section enter"
        style={{ '--i': 0 }}
        aria-labelledby="appearance-title"
      >
        <div className="section-head">
          <h2 id="appearance-title" className="panel__title">
            Оформление
          </h2>
          <span className="muted small" data-testid="sync-status" aria-live="polite">
            {sync.status === 'saving' && 'Сохраняем…'}
            {sync.status === 'saved' && 'Сохранено в аккаунте'}
            {sync.status === 'failed' && 'Применено на этом устройстве, но не сохранено'}
          </span>
        </div>

        <h3 className="field__label">Тема</h3>
        <div className="theme-grid" role="radiogroup" aria-label="Тема">
          {THEME_OPTIONS.map((option) => {
            const preview = resolveTheme(option.value, theme.environment);
            const active = theme.preference === option.value;
            const unavailable = option.value === 'telegram' && !theme.environment.telegram;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`theme-option${active ? ' is-active' : ''}`}
                onClick={() => chooseTheme(option.value)}
                data-testid={`theme-${option.value}`}
              >
                <Swatch tokens={preview.tokens} />
                <span className="theme-option__label">
                  {active && <IconCheck size={16} />}
                  {option.label}
                </span>
                <span className="muted small">
                  {unavailable ? 'Вне Telegram — как в устройстве' : option.hint}
                </span>
              </button>
            );
          })}
        </div>
        <p className="muted small" data-testid="theme-current">
          Сейчас: {theme.resolved.scheme === 'dark' ? 'тёмная' : 'светлая'} · {sourceLabel}
        </p>
        {sync.status === 'failed' && (
          <p className="form__error" role="alert">
            {sync.message}
          </p>
        )}

        <h3 className="field__label">Плотность интерфейса</h3>
        <div className="segmented" role="radiogroup" aria-label="Плотность интерфейса">
          {DENSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme.density === option.value}
              className={`segmented__item${theme.density === option.value ? ' is-active' : ''}`}
              onClick={() => chooseDensity(option.value)}
              data-testid={`density-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="muted small">На сенсорных экранах кнопки остаются не меньше 44 px.</p>
      </section>

      <section
        className="card panel settings-section enter"
        style={{ '--i': 1 }}
        aria-labelledby="account-title"
      >
        <h2 id="account-title" className="panel__title">
          Аккаунт
        </h2>
        <div className="account">
          {user.photoUrl ? (
            <img className="avatar" src={user.photoUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="avatar" aria-hidden="true">
              {initials(user.firstName, user.lastName)}
            </span>
          )}
          <div>
            <strong data-testid="account-name">
              {[user.firstName, user.lastName].filter(Boolean).join(' ')}
            </strong>
            <p className="muted small">
              {user.username ? `@${user.username} · ` : ''}ID {user.telegramId}
            </p>
          </div>
        </div>
        <dl className="facts">
          <dt>Проекты</dt>
          <dd>
            {quotas.projects.used} из {quotas.projects.limit}
          </dd>
          <dt>Сессия до</dt>
          <dd>{formatDateTime(session.expiresAt)}</dd>
        </dl>
        <button
          type="button"
          className="btn btn--ghost btn--danger-text"
          onClick={() => setConfirmLogout(true)}
          data-testid="logout"
        >
          Выйти
        </button>
      </section>

      <section
        className="card panel settings-section enter"
        style={{ '--i': 2 }}
        aria-labelledby="about-title"
      >
        <h2 id="about-title" className="panel__title">
          О приложении
        </h2>
        <dl className="facts">
          <dt>Среда</dt>
          <dd>{tg.isTelegram ? `Telegram ${tg.platform}, Bot API ${tg.version}` : 'Браузер'}</dd>
          <dt>Схема проекта</dt>
          <dd>v{PROJECT_SCHEMA_VERSION}</dd>
        </dl>
      </section>

      {confirmLogout && (
        <ConfirmDialog
          title="Выйти из аккаунта?"
          description="Проекты останутся на сервере. В Telegram можно войти снова одной кнопкой."
          confirmLabel="Выйти"
          onConfirm={() => void logout()}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </div>
  );
}
