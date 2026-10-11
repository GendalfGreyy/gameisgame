import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`gig-card rounded-3xl border p-4 shadow-card ${onClick ? 'text-left transition active:scale-[0.99]' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}

export function PrimaryButton({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`btn-shine gig-gradient-bg gig-glow rounded-2xl px-5 py-3.5 text-[15px] font-semibold text-white transition duration-150 active:scale-[0.97] disabled:opacity-50 disabled:shadow-none ${className}`}
      {...props}
    >
      <span className="relative z-[1]">{children}</span>
    </button>
  );
}

export function SecondaryButton({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`gig-card rounded-2xl border px-5 py-3.5 text-[15px] font-semibold text-gig-ink shadow-card transition hover:bg-gig-surface disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`text-sm font-medium text-gig-muted transition hover:text-gig-ink ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Oval segmented toolbar — messenger profile `tabsPill` style. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="msgr-segment-bar flex w-full rounded-full p-0.5">
      {options.map((option, index) => {
        const active = option.value === value;
        const isLast = index === options.length - 1;
        return (
          <div key={option.value} className="flex min-w-0 flex-1 items-stretch">
            <button
              type="button"
              onClick={() => onChange(option.value)}
              className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-full px-2 py-1.5"
            >
              {active ? (
                <span className="msgr-segment-active absolute inset-0 rounded-full" />
              ) : null}
              <span
                className="relative text-sm"
                style={{
                  color: active ? 'var(--gig-segment-text-active)' : 'var(--gig-segment-text)',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {option.label}
              </span>
            </button>
            {!isLast ? (
              <span
                className="my-1 w-px shrink-0"
                style={{ background: 'var(--gig-divider)' }}
                aria-hidden
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Filter chip — messenger search screen style. */
export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-4 py-2 text-sm transition"
      style={{
        background: active ? 'var(--gig-chip-active-bg)' : 'var(--gig-chip-bg)',
        color: active ? 'var(--gig-chip-active-text)' : 'var(--gig-chip-text)',
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </button>
  );
}

export function ThemeSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-gig-accent' : 'bg-gig-surface'
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-card transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-[26px] font-bold tracking-tight text-gig-ink">{title}</h2>
      {subtitle ? <p className="text-sm text-gig-muted">{subtitle}</p> : null}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3 text-sm"
      style={{
        background: 'var(--gig-error-bg)',
        borderColor: 'var(--gig-error-border)',
        color: 'var(--gig-error-text)',
      }}
    >
      {message}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="bg-gig-surface/60">
      <p className="font-semibold text-gig-ink">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-gig-muted">{description}</p>
    </Card>
  );
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`gig-input w-full rounded-2xl border px-4 py-3 text-[15px] text-gig-ink outline-none transition placeholder:text-gig-muted/70 focus:border-gig-accent focus:ring-2 focus:ring-gig-accent/20 ${className}`}
      {...props}
    />
  );
}

export function TextArea({
  className = '',
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`gig-input w-full rounded-2xl border px-4 py-3 text-[15px] text-gig-ink outline-none transition placeholder:text-gig-muted/70 focus:border-gig-accent focus:ring-2 focus:ring-gig-accent/20 ${className}`}
      {...props}
    />
  );
}

export function Avatar({
  name,
  photoUrl,
  size = 'lg',
}: {
  name: string;
  photoUrl?: string | null;
  size?: 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'h-20 w-20 text-2xl' : 'h-12 w-12 text-lg';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={`${sizeClass} rounded-full object-cover ring-2 ring-[var(--gig-card)] shadow-card`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-[var(--gig-primary-bg)] font-semibold text-[var(--gig-primary-text)] shadow-card`}
    >
      {initial}
    </div>
  );
}

export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-gig-ink">{value}</p>
      <p className="text-xs text-gig-muted">{label}</p>
    </div>
  );
}
