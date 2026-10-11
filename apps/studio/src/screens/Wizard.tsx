import {
  PROJECT_TITLE_MAX,
  projectTitleSchema,
  type Orientation,
  type ProjectTemplateId,
  type ProjectTypeDto,
} from '@tg-creator/shared';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { useAuth } from '../app/auth.js';
import { useToast } from '../app/toast.js';
import { IconBack, IconCheck } from '../components/icons.js';
import { ApiRequestError, errorMessage } from '../lib/api.js';
import { PROJECT_TYPES, projectTypeInfo } from '../lib/projectTypes.js';
import { goBack, navigate } from '../lib/router.js';

type Step = 1 | 2 | 3;

const ORIENTATIONS: ReadonlyArray<{ value: Orientation; label: string }> = [
  { value: 'auto', label: 'Авто' },
  { value: 'portrait', label: 'Портрет' },
  { value: 'landscape', label: 'Ландшафт' },
];

const STEP_TITLES: Record<Step, string> = {
  1: 'Что создаём?',
  2: 'С чего начать?',
  3: 'Название',
};

/** S03: Type → Template → Name/Orientation → Create. Fullscreen on phones, modal on desktop. */
export function Wizard({ initialType }: { initialType?: ProjectTypeDto | undefined }) {
  const { withSession, refreshMe } = useAuth();
  const { notify } = useToast();
  const [step, setStep] = useState<Step>(initialType ? 2 : 1);
  const [type, setType] = useState<ProjectTypeDto>(initialType ?? 'game3d');
  const [templateId, setTemplateId] = useState<ProjectTemplateId>('starter');
  const [title, setTitle] = useState(projectTypeInfo(initialType ?? 'game3d').defaultTitle);
  const [titleTouched, setTitleTouched] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 3) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [step]);

  const info = projectTypeInfo(type);
  const titleCheck = projectTitleSchema.safeParse(title);
  const titleError = titleCheck.success ? null : (titleCheck.error.issues[0]?.message ?? null);

  const chooseType = (next: ProjectTypeDto) => {
    setType(next);
    if (!titleTouched) {
      setTitle(projectTypeInfo(next).defaultTitle);
    }
    setStep(2);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTitleTouched(true);
    if (!titleCheck.success || submitting) {
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await withSession((api) =>
        api.createProject({
          title: titleCheck.data,
          type,
          templateId,
          orientation: type === 'app' ? 'auto' : orientation,
        }),
      );
      void refreshMe().catch(() => undefined);
      notify('Проект создан');
      navigate({ name: 'project', projectId: result.projectId }, { replace: true });
    } catch (error) {
      setServerError(errorMessage(error));
      if (!(error instanceof ApiRequestError) || error.code === null) {
        notify(errorMessage(error), 'error');
      }
      setSubmitting(false);
    }
  };

  const back = () => {
    if (step === 1) {
      goBack();
    } else {
      setStep((step - 1) as Step);
    }
  };

  return (
    <div className="wizard-backdrop">
      <section
        className="wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="wizard"
      >
        <header className="wizard__header">
          <button type="button" className="icon-btn" onClick={back} aria-label="Назад">
            <IconBack />
          </button>
          <div className="wizard__heading">
            <span className="muted small">Шаг {step} из 3</span>
            <h1 id={titleId} className="wizard__title">
              {STEP_TITLES[step]}
            </h1>
          </div>
          <button type="button" className="btn btn--ghost btn--small" onClick={goBack}>
            Отмена
          </button>
        </header>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        {step === 1 && (
          <div className="options" role="radiogroup" aria-label="Тип проекта">
            {PROJECT_TYPES.map((item) => (
              <button
                key={item.type}
                type="button"
                role="radio"
                aria-checked={type === item.type}
                className={`option${type === item.type ? ' is-active' : ''}`}
                onClick={() => chooseType(item.type)}
                data-testid={`wizard-type-${item.type}`}
              >
                <span className={`type-icon type-icon--${item.type}`}>{item.icon(24)}</span>
                <span className="option__body">
                  <strong>{item.label}</strong>
                  <span className="muted small">{item.description}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <>
            <div className="options" role="radiogroup" aria-label="Шаблон">
              {(
                [
                  {
                    id: 'starter',
                    label: 'Стартовый шаблон',
                    description: info.starterDescription,
                  },
                  {
                    id: 'empty',
                    label: 'Пустой проект',
                    description:
                      type === 'app'
                        ? 'Одна пустая страница.'
                        : 'Только камера' + (type === 'game3d' ? ' и свет.' : '.'),
                  },
                ] as const
              ).map((template) => (
                <button
                  key={template.id}
                  type="button"
                  role="radio"
                  aria-checked={templateId === template.id}
                  className={`option${templateId === template.id ? ' is-active' : ''}`}
                  onClick={() => setTemplateId(template.id)}
                  data-testid={`wizard-template-${template.id}`}
                >
                  <span className="option__check" aria-hidden="true">
                    {templateId === template.id && <IconCheck size={16} />}
                  </span>
                  <span className="option__body">
                    <strong>{template.label}</strong>
                    <span className="muted small">{template.description}</span>
                  </span>
                </button>
              ))}
            </div>
            <footer className="wizard__footer">
              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={() => setStep(3)}
                data-testid="wizard-next"
              >
                Далее
              </button>
            </footer>
          </>
        )}

        {step === 3 && (
          <form className="form" onSubmit={(event) => void submit(event)} noValidate>
            <label className="field">
              <span className="field__label">Название проекта</span>
              <input
                ref={inputRef}
                className={`input${titleTouched && titleError ? ' is-invalid' : ''}`}
                value={title}
                maxLength={PROJECT_TITLE_MAX + 20}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setTitleTouched(true);
                }}
                aria-invalid={titleTouched && titleError ? true : undefined}
                data-testid="wizard-title"
                enterKeyHint="done"
              />
              <span className={`field__hint${titleTouched && titleError ? ' is-error' : ''}`}>
                {titleTouched && titleError
                  ? titleError
                  : `${title.trim().length}/${PROJECT_TITLE_MAX}`}
              </span>
            </label>

            {type !== 'app' && (
              <div className="field">
                <span className="field__label">Ориентация экрана</span>
                <div className="segmented" role="radiogroup" aria-label="Ориентация экрана">
                  {ORIENTATIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={orientation === item.value}
                      className={`segmented__item${orientation === item.value ? ' is-active' : ''}`}
                      onClick={() => setOrientation(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="summary muted small">
              {info.label} · {templateId === 'starter' ? 'стартовый шаблон' : 'пустой проект'}
            </div>

            {serverError && (
              <p className="form__error" role="alert">
                {serverError}
              </p>
            )}

            <footer className="wizard__footer">
              <button
                type="submit"
                className="btn btn--primary btn--block"
                disabled={submitting}
                data-testid="wizard-create"
              >
                {submitting ? 'Создаём…' : 'Создать проект'}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
