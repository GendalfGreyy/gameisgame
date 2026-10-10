import { haptics } from '../../shared/lib/haptics.js';

export function CreateHubScreen({
  onCreateEvent,
  onOpenStudio,
}: {
  onCreateEvent: () => void;
  onOpenStudio: () => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gig-accent">
          Создать
        </p>
        <h1 className="text-[30px] font-bold leading-tight text-gig-ink">Что делаем?</h1>
        <p className="text-[14px] leading-relaxed text-gig-muted">
          Офлайн-движ рядом — или своя игра прямо в Telegram Mini App.
        </p>
      </header>

      <button
        type="button"
        onClick={() => {
          haptics.tap();
          onOpenStudio();
        }}
        className="studio-hero-card relative overflow-hidden rounded-[28px] p-5 text-left transition active:scale-[0.99]"
      >
        <div className="studio-hero-glow" aria-hidden />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7CFFCB]">
          Creator Studio
        </p>
        <h2 className="relative mt-2 text-[24px] font-bold text-white">Собрать игру</h2>
        <p className="relative mt-2 max-w-[18rem] text-[14px] leading-relaxed text-white/70">
          Редактор сцены как упрощённый Roblox Studio: объекты, физика, Play и шаринг друзьям.
        </p>
        <span className="relative mt-4 inline-flex text-[14px] font-semibold text-[#3DDC97]">
          Открыть Studio →
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          haptics.tap();
          onCreateEvent();
        }}
        className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-left transition active:scale-[0.99]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gig-muted">
          Офлайн
        </p>
        <h2 className="mt-2 text-[22px] font-bold text-gig-ink">Событие на карте</h2>
        <p className="mt-2 text-[14px] text-gig-muted">
          Собери людей рядом: чек-ины, очки, лидерборд.
        </p>
        <span className="mt-4 inline-flex text-[14px] font-semibold text-gig-accent">
          Создать событие →
        </span>
      </button>
    </section>
  );
}
