import { useEffect, useId, useState, type KeyboardEvent } from 'react';

/** Rounds away float noise (0.30000000000000004) without hiding real precision. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  return String(Math.round(value * 10_000) / 10_000);
}

export function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || normalized === '-' || normalized === '.') {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

type Commit<T> = (value: T) => boolean;

type NumberInputProps = {
  value: number;
  label: string;
  onCommit: Commit<number>;
  integer?: boolean | undefined;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  testId?: string;
};

/**
 * Edits commit on Enter or blur — one EditorCommand per edit, not per keystroke.
 * Escape restores the stored value; a rejected value stays visible with an error.
 */
export function NumberInput({
  value,
  label,
  onCommit,
  integer,
  min,
  max,
  step,
  testId,
}: NumberInputProps) {
  const [draft, setDraft] = useState(formatNumber(value));
  const [invalid, setInvalid] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(formatNumber(value));
      setInvalid(false);
    }
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parseNumber(draft);
    if (parsed === null || (integer && !Number.isInteger(parsed))) {
      setInvalid(true);
      return;
    }
    if (parsed === value) {
      setInvalid(false);
      setDraft(formatNumber(value));
      return;
    }
    const ok = onCommit(parsed);
    setInvalid(!ok);
    if (ok) {
      setDraft(formatNumber(parsed));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraft(formatNumber(value));
      setInvalid(false);
      setEditing(false);
      event.currentTarget.blur();
    }
  };

  return (
    <input
      className={`ed-num${invalid ? ' is-invalid' : ''}`}
      type="text"
      inputMode="decimal"
      enterKeyHint="done"
      autoComplete="off"
      aria-label={label}
      aria-invalid={invalid || undefined}
      title={
        invalid
          ? `Недопустимое значение${min !== undefined ? `, минимум ${min}` : ''}${max !== undefined ? `, максимум ${max}` : ''}`
          : undefined
      }
      data-step={step}
      data-testid={testId}
      value={draft}
      onFocus={(event) => {
        setEditing(true);
        event.currentTarget.select();
      }}
      onChange={(event) => {
        setEditing(true);
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

const AXES = ['X', 'Y', 'Z'] as const;

export function VectorField({
  label,
  value,
  onCommit,
  step,
  testId,
}: {
  label: string;
  value: readonly number[];
  onCommit: (value: number[]) => boolean;
  step: number;
  testId?: string;
}) {
  return (
    <div className="ed-prop" role="group" aria-label={label}>
      <span className="ed-prop__label">{label}</span>
      <div className={`ed-vec ed-vec--${value.length}`}>
        {value.map((component, index) => {
          const axis = AXES[index] ?? String(index);
          return (
            <label key={axis} className="ed-vec__axis">
              <span className={`ed-vec__tag ed-vec__tag--${axis.toLowerCase()}`}>{axis}</span>
              <NumberInput
                value={component}
                label={`${label} ${axis}`}
                step={step}
                {...(testId ? { testId: `${testId}-${axis.toLowerCase()}` } : {})}
                onCommit={(next) => {
                  const copy = [...value];
                  copy[index] = next;
                  return onCommit(copy);
                }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function NumberField(props: NumberInputProps) {
  return (
    <div className="ed-prop">
      <span className="ed-prop__label" aria-hidden="true">
        {props.label}
      </span>
      <div className="ed-prop__control">
        <NumberInput {...props} />
      </div>
    </div>
  );
}

const HEX = /^#?([0-9A-Fa-f]{6})$/;

/**
 * Swatch drags commit live but merge into one Undo step (`live: true`), ended on blur;
 * the hex field commits on Enter/blur like number fields.
 */
export function ColorField({
  label,
  value,
  onCommit,
  onLiveEnd,
  testId,
}: {
  label: string;
  value: string;
  onCommit: (value: string, live: boolean) => boolean;
  onLiveEnd?: () => void;
  testId?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value.toUpperCase());
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(value.toUpperCase());
      setInvalid(false);
    }
  }, [value, editing]);

  const commitHex = () => {
    setEditing(false);
    const match = HEX.exec(draft.trim());
    if (!match?.[1]) {
      setInvalid(true);
      return;
    }
    const next = `#${match[1].toUpperCase()}`;
    setInvalid(false);
    if (next !== value.toUpperCase()) {
      setInvalid(!onCommit(next, false));
    }
  };

  return (
    <div className="ed-prop">
      <label className="ed-prop__label" htmlFor={id}>
        {label}
      </label>
      <div className="ed-prop__control ed-color">
        <input
          id={id}
          type="color"
          className="ed-color__swatch"
          value={value.toLowerCase()}
          onChange={(event) => onCommit(event.target.value.toUpperCase(), true)}
          onBlur={() => onLiveEnd?.()}
        />
        <input
          className={`ed-num mono ed-color__hex${invalid ? ' is-invalid' : ''}`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          maxLength={7}
          aria-label={`${label}, HEX`}
          aria-invalid={invalid || undefined}
          data-testid={testId}
          value={draft}
          onFocus={(event) => {
            setEditing(true);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            setEditing(true);
            setDraft(event.target.value);
          }}
          onBlur={commitHex}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              setDraft(value.toUpperCase());
              setInvalid(false);
              setEditing(false);
              event.currentTarget.blur();
            }
          }}
        />
      </div>
    </div>
  );
}

export function BooleanField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: boolean;
  onCommit: Commit<boolean>;
}) {
  return (
    <label className="ed-prop ed-prop--toggle">
      <span className="ed-prop__label">{label}</span>
      <input
        type="checkbox"
        role="switch"
        className="ed-switch"
        checked={value}
        onChange={(event) => onCommit(event.target.checked)}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  onCommit,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onCommit: Commit<string>;
  disabled?: boolean;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="ed-prop">
      <label className="ed-prop__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="ed-select"
        value={value}
        disabled={disabled}
        data-testid={testId}
        onChange={(event) => onCommit(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
