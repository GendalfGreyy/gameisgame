import type { StudioScene } from '@game-is-game/shared';
import { encodeStudioGameStartParam } from '@game-is-game/shared';
import { useEffect, useMemo, useState } from 'react';

import { haptics } from '../../shared/lib/haptics.js';
import { shareUrl } from '../../shared/lib/telegram.js';
import {
  ErrorBanner,
  GhostButton,
  PrimaryButton,
  SecondaryButton,
} from '../../shared/ui/primitives.js';
import { usePublishStudioProject, useStudioProject, useUpdateStudioProject } from './hooks.js';
import { SceneCanvas } from './SceneCanvas.js';
import {
  STUDIO_PALETTE,
  addPaletteEntity,
  behaviorLabel,
  removeEntity,
  updateEntity,
  type PaletteItem,
} from './scene-utils.js';

export function StudioEditorScreen({
  projectId,
  onBack,
  onPlay,
}: {
  projectId: string;
  onBack: () => void;
  onPlay: () => void;
}) {
  const detail = useStudioProject(projectId);
  const save = useUpdateStudioProject(projectId);
  const publish = usePublishStudioProject(projectId);

  const [scene, setScene] = useState<StudioScene | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (detail.data) {
      setScene(detail.data.scene);
      setTitle(detail.data.title);
      setDirty(false);
    }
  }, [detail.data?.id, detail.dataUpdatedAt]);

  const selected = useMemo(
    () => scene?.entities.find((e) => e.id === selectedId) ?? null,
    [scene, selectedId],
  );

  if (detail.isLoading || !scene) {
    return <p className="text-sm text-gig-muted">Открываю редактор…</p>;
  }
  if (detail.error) {
    return (
      <section className="space-y-3">
        <GhostButton onClick={onBack}>← Назад</GhostButton>
        <ErrorBanner message={detail.error.message} />
      </section>
    );
  }

  const patchScene = (next: StudioScene) => {
    setScene(next);
    setDirty(true);
  };

  const onSave = async () => {
    haptics.tap();
    await save.mutateAsync({ title: title.trim() || detail.data!.title, scene });
    setDirty(false);
  };

  const onPublish = async () => {
    haptics.success();
    if (dirty) {
      await save.mutateAsync({ title: title.trim() || detail.data!.title, scene });
      setDirty(false);
    }
    const result = await publish.mutateAsync();
    shareUrl(result.shareUrl, `Играй в «${title}»`);
  };

  const addItem = (item: PaletteItem) => {
    haptics.tap();
    patchScene(addPaletteEntity(scene, item));
  };

  return (
    <section className="flex flex-1 flex-col gap-3 pb-2">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <GhostButton onClick={onBack}>← Проекты</GhostButton>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            className="w-full bg-transparent text-[22px] font-bold text-gig-ink outline-none"
          />
          <p className="text-[12px] text-gig-muted">
            {dirty ? 'Есть несохранённые изменения' : 'Сохранено'} · {scene.entities.length}{' '}
            объектов
          </p>
        </div>
      </header>

      <div className="studio-viewport overflow-hidden rounded-3xl">
        <SceneCanvas
          mode="edit"
          scene={scene}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(id, x, y) => patchScene(updateEntity(scene, id, { x, y }))}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STUDIO_PALETTE.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => addItem(item)}
            className="studio-chip shrink-0 rounded-2xl px-3 py-2 text-[12px] font-semibold text-gig-ink"
          >
            <span
              className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: item.color }}
            />
            {item.label}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="studio-panel space-y-3 rounded-3xl p-3">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-gig-ink">{selected.name}</p>
            <GhostButton
              onClick={() => {
                patchScene(removeEntity(scene, selected.id));
                setSelectedId(null);
              }}
            >
              Удалить
            </GhostButton>
          </div>
          <p className="text-[12px] text-gig-muted">
            {selected.behaviors.map(behaviorLabel).join(' · ') || 'Без поведения'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12px] text-gig-muted">
              Ширина
              <input
                type="number"
                value={selected.w}
                min={8}
                max={400}
                onChange={(e) =>
                  patchScene(updateEntity(scene, selected.id, { w: Number(e.target.value) || 8 }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-gig-ink"
              />
            </label>
            <label className="text-[12px] text-gig-muted">
              Высота
              <input
                type="number"
                value={selected.h}
                min={8}
                max={400}
                onChange={(e) =>
                  patchScene(updateEntity(scene, selected.id, { h: Number(e.target.value) || 8 }))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-gig-ink"
              />
            </label>
          </div>
          <label className="block text-[12px] text-gig-muted">
            Цвет
            <input
              type="color"
              value={selected.color}
              onChange={(e) =>
                patchScene(updateEntity(scene, selected.id, { color: e.target.value }))
              }
              className="mt-1 h-10 w-full cursor-pointer rounded-xl bg-transparent"
            />
          </label>
        </div>
      ) : (
        <p className="text-[13px] text-gig-muted">
          Тапни объект на сцене, чтобы двигать и менять. Добавляй блоки из палитры сверху.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <SecondaryButton disabled={save.isPending || !dirty} onClick={() => void onSave()}>
          {save.isPending ? '…' : 'Save'}
        </SecondaryButton>
        <PrimaryButton
          onClick={() => {
            void (async () => {
              if (dirty) await onSave();
              onPlay();
            })();
          }}
        >
          Play
        </PrimaryButton>
        <SecondaryButton disabled={publish.isPending} onClick={() => void onPublish()}>
          {publish.isPending ? '…' : 'Share'}
        </SecondaryButton>
      </div>

      {detail.data?.status === 'published' ? (
        <p className="text-center text-[12px] text-gig-muted">
          Deep link: <code>{encodeStudioGameStartParam(projectId)}</code>
        </p>
      ) : null}

      {save.error ? <ErrorBanner message={save.error.message} /> : null}
      {publish.error ? <ErrorBanner message={publish.error.message} /> : null}
    </section>
  );
}
