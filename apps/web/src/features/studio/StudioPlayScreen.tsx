import { useEffect, useMemo, useState } from 'react';

import { haptics } from '../../shared/lib/haptics.js';
import {
  ErrorBanner,
  GhostButton,
  PrimaryButton,
  SecondaryButton,
} from '../../shared/ui/primitives.js';
import { createRuntimeFromScene } from './engine.js';
import { usePublishedStudioGame, useRecordStudioPlay, useStudioProject } from './hooks.js';
import { SceneCanvas } from './SceneCanvas.js';

export function StudioPlayScreen({
  projectId,
  onBack,
  onEdit,
  preferPublished = false,
}: {
  projectId: string;
  onBack: () => void;
  onEdit?: () => void;
  preferPublished?: boolean;
}) {
  const owned = useStudioProject(preferPublished ? null : projectId);
  const published = usePublishedStudioGame(preferPublished ? projectId : null);
  const detail = preferPublished ? published : owned;
  const recordPlay = useRecordStudioPlay(projectId);

  const runtime = useMemo(() => {
    if (!detail.data?.scene) return null;
    return createRuntimeFromScene(detail.data.scene);
  }, [detail.data?.scene, detail.dataUpdatedAt]);

  const [hud, setHud] = useState({ status: 'playing', score: 0, collected: 0, total: 0 });

  useEffect(() => {
    if (!detail.data) return;
    void recordPlay.mutateAsync().catch(() => undefined);
  }, [detail.data?.id]);

  useEffect(() => {
    if (!runtime) return;
    const onKey = (e: KeyboardEvent) => {
      const down = e.type === 'keydown';
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) runtime.setInput({ left: down });
      if (['ArrowRight', 'd', 'D'].includes(e.key)) runtime.setInput({ right: down });
      if (['ArrowUp', 'w', 'W'].includes(e.key)) runtime.setInput({ up: down, jump: down });
      if (['ArrowDown', 's', 'S'].includes(e.key)) runtime.setInput({ down: down });
      if (e.key === ' ' || e.key === 'Spacebar') runtime.setInput({ jump: down });
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    const id = window.setInterval(() => {
      const state = runtime.getState();
      setHud({
        status: state.status,
        score: state.score,
        collected: state.collected,
        total: state.totalCollectibles,
      });
    }, 100);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.clearInterval(id);
    };
  }, [runtime]);

  if (detail.isLoading) {
    return <p className="text-sm text-gig-muted">Загружаю игру…</p>;
  }
  if (detail.error) {
    return (
      <section className="space-y-4">
        <GhostButton onClick={onBack}>← Назад</GhostButton>
        <ErrorBanner message={detail.error.message} />
      </section>
    );
  }
  if (!detail.data || !runtime) {
    return null;
  }

  return (
    <section className="flex flex-1 flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <GhostButton onClick={onBack}>← Назад</GhostButton>
          <h1 className="text-[22px] font-bold text-gig-ink">{detail.data.title}</h1>
          <p className="text-[12px] text-gig-muted">
            {detail.data.owner.firstName}
            {detail.data.owner.username ? ` @${detail.data.owner.username}` : ''}
          </p>
        </div>
        <div className="rounded-2xl bg-black/25 px-3 py-2 text-right text-[12px] text-gig-ink">
          <div>{hud.score} pts</div>
          <div className="text-gig-muted">
            {hud.collected}/{hud.total}
          </div>
        </div>
      </header>

      <div className="studio-viewport overflow-hidden rounded-3xl">
        <SceneCanvas mode="play" runtime={runtime} />
      </div>

      {hud.status === 'won' ? (
        <p className="text-center text-[15px] font-semibold text-gig-accent">Победа!</p>
      ) : null}
      {hud.status === 'lost' ? (
        <p className="text-center text-[15px] font-semibold text-red-400">Поражение</p>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <TouchPad label="◀" onPress={(down) => runtime.setInput({ left: down })} />
        <TouchPad
          label="▲ / прыжок"
          onPress={(down) => runtime.setInput({ up: down, jump: down })}
        />
        <TouchPad label="▶" onPress={(down) => runtime.setInput({ right: down })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TouchPad label="▼" onPress={(down) => runtime.setInput({ down: down })} />
        <SecondaryButton
          onClick={() => {
            haptics.tap();
            runtime.restart();
          }}
        >
          Заново
        </SecondaryButton>
      </div>

      {onEdit && detail.data.isOwner ? (
        <PrimaryButton onClick={onEdit}>В редактор</PrimaryButton>
      ) : null}
    </section>
  );
}

function TouchPad({ label, onPress }: { label: string; onPress: (down: boolean) => void }) {
  return (
    <button
      type="button"
      className="select-none rounded-2xl border border-white/10 bg-white/5 py-4 text-[15px] font-semibold text-gig-ink active:bg-white/15"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress(true);
        (e.target as HTMLButtonElement).setPointerCapture(e.pointerId);
      }}
      onPointerUp={() => onPress(false)}
      onPointerCancel={() => onPress(false)}
    >
      {label}
    </button>
  );
}
