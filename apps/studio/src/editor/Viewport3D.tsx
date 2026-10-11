import { builtinModelGlb } from '@tg-creator/asset-sdk';
import { activeScene, getEntity, setTransformCommand } from '@tg-creator/editor-core';
import type { OrbitState, SceneViewport, TransformEvent, ViewMode } from '@tg-creator/engine-3d';
import { useEffect, useRef, useState } from 'react';

import { useTheme } from '../app/theme.js';
import { useToast } from '../app/toast.js';
import { readStored, writeStored } from '../lib/storage.js';
import { useEditorState, useEditorUi, useSession } from './context.js';
import { Viewport } from './Viewport.js';

declare global {
  interface Window {
    /** Dev builds only: lets Playwright find on-screen positions of entities and gizmo handles. */
    __tgcViewport?: SceneViewport;
  }
}

const CAMERA_SAVE_DELAY_MS = 400;
const HEX = /^#[0-9A-Fa-f]{6}$/;

function cameraKey(projectId: string): string {
  return `tgc.editor.camera.${projectId}`;
}

function supportsWebGl2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

function transformLabel(patch: TransformEvent['patch'], name: string): string {
  if (patch.rotationEuler) return `Повернуть «${name}»`;
  if (patch.scale) return `Масштабировать «${name}»`;
  return `Переместить «${name}»`;
}

async function loadModel(assetId: string): Promise<Uint8Array | null> {
  // Uploaded models arrive with the asset pipeline (G5); until then only built-ins resolve.
  return builtinModelGlb(assetId);
}

/**
 * Scene view: the PlayCanvas viewport for 3D projects, the schematic for 2D projects and
 * for devices without WebGL2.
 */
export function SceneView() {
  const projectType = useEditorState((state) => state.document.type);
  const [failure, setFailure] = useState<string | null>(() =>
    projectType === 'game3d' && !supportsWebGl2() ? 'WebGL2 недоступен — показана схема' : null,
  );
  if (projectType !== 'game3d' || failure) {
    return (
      <>
        <Viewport />
        {failure ? (
          <div className="ed-viewport__fallback" role="status" data-testid="viewport-fallback">
            {failure}
          </div>
        ) : null}
      </>
    );
  }
  return <Viewport3D onFailure={setFailure} />;
}

let gizmoGesture = 0;

function Viewport3D({ onFailure }: { onFailure: (message: string) => void }) {
  const session = useSession();
  const ui = useEditorUi();
  const { notify } = useToast();
  const { resolved } = useTheme();
  const projectId = useEditorState((state) => state.document.id);
  const hasCamera = useEditorState((state) => {
    const scene = activeScene(state);
    return scene
      ? Object.values(scene.entities).some((entity) =>
          entity.components.some((component) => component.type === 'camera' && component.enabled),
        )
      : false;
  });
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<SceneViewport | null>(null);
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('editor');

  const background = HEX.test(resolved.tokens.bg) ? resolved.tokens.bg : '#1C1B18';

  // Values read inside engine callbacks without re-creating the engine.
  const latest = useRef({ ui, notify, onFailure });
  latest.current = { ui, notify, onFailure };

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) {
      return undefined;
    }
    let disposed = false;
    let viewport: SceneViewport | null = null;
    let unsubscribe: (() => void) | null = null;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let mergeKey: string | null = null;

    const storedCamera = (isOrbit: (value: unknown) => value is OrbitState) => {
      try {
        const parsed: unknown = JSON.parse(readStored(cameraKey(projectId)) ?? 'null');
        return isOrbit(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    };

    const flushCamera = () => {
      if (saveTimer && viewport) {
        clearTimeout(saveTimer);
        saveTimer = null;
        writeStored(cameraKey(projectId), JSON.stringify(viewport.getCamera()));
      }
    };
    // Telegram may close the webview without unmounting React.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushCamera();
    };
    window.addEventListener('pagehide', flushCamera);
    document.addEventListener('visibilitychange', onHidden);

    const updatePlacement = () => {
      if (viewport) {
        const [x, y, z] = viewport.placementPoint();
        latest.current.ui.placementRef.current = [x, y, z];
      }
    };

    const onTransform = (event: TransformEvent) => {
      if (event.phase === 'start') {
        gizmoGesture += 1;
        mergeKey = `gizmo-${gizmoGesture}`;
        return;
      }
      const state = session.getState();
      const scene = activeScene(state);
      if (state.sceneId !== null && scene) {
        const command = setTransformCommand(
          state.document,
          state.sceneId,
          event.entityId,
          event.patch,
        );
        if (command) {
          const name = getEntity(scene, event.entityId)?.name ?? 'объект';
          session.dispatch(command, {
            label: transformLabel(event.patch, name),
            ...(mergeKey ? { mergeKey } : {}),
          });
        }
      }
      if (event.phase === 'end') {
        session.closeMergeGroup();
        mergeKey = null;
      }
    };

    import('@tg-creator/engine-3d')
      .then((engine) => {
        if (disposed) {
          return;
        }
        const camera = storedCamera(engine.isOrbitState);
        try {
          viewport = engine.createScene({
            canvas,
            eventTarget: host,
            loadModel,
            background,
            touch:
              latest.current.ui.layout === 'mobile' ||
              window.matchMedia('(pointer: coarse)').matches,
            ...(camera ? { camera } : {}),
            onPick: (entityId) => session.select(entityId ? [entityId] : []),
            onTransform,
            onCameraChange: (state) => {
              updatePlacement();
              if (saveTimer) clearTimeout(saveTimer);
              saveTimer = setTimeout(() => {
                writeStored(cameraKey(projectId), JSON.stringify(state));
              }, CAMERA_SAVE_DELAY_MS);
            },
            onViewModeChange: setViewMode,
            onWarning: (message) => latest.current.notify(message, 'error'),
          });
        } catch {
          latest.current.onFailure('3D-движок не запустился — показана схема');
          return;
        }
        viewportRef.current = viewport;
        if (import.meta.env.DEV) {
          window.__tgcViewport = viewport;
        }
        let last = session.getState();
        viewport.applyChanges(last.document, last.sceneId);
        viewport.select(last.selection);
        updatePlacement();
        unsubscribe = session.subscribe(() => {
          const next = session.getState();
          if (!viewport) return;
          if (next.document !== last.document || next.sceneId !== last.sceneId) {
            viewport.applyChanges(next.document, next.sceneId);
          }
          if (next.selection !== last.selection || next.sceneId !== last.sceneId) {
            viewport.select(next.selection);
          }
          last = next;
        });
        setReady(true);
      })
      .catch(() => {
        if (!disposed) {
          latest.current.onFailure('Не удалось загрузить 3D-движок — показана схема');
        }
      });

    return () => {
      disposed = true;
      unsubscribe?.();
      flushCamera();
      window.removeEventListener('pagehide', flushCamera);
      document.removeEventListener('visibilitychange', onHidden);
      if (window.__tgcViewport === viewport) {
        delete window.__tgcViewport;
      }
      viewport?.dispose();
      viewportRef.current = null;
      setReady(false);
    };
    // The engine is created once per project and background; the rest flows through refs.
  }, [session, projectId, background]);

  useEffect(() => {
    viewportRef.current?.setTool(ui.tool);
  }, [ui.tool, ready]);

  useEffect(() => {
    viewportRef.current?.setSnap(snap);
  }, [snap, ready]);

  const focusToken = ui.focusToken;
  const lastFocus = useRef(focusToken);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || focusToken === lastFocus.current) {
      return;
    }
    lastFocus.current = focusToken;
    const state = session.getState();
    const scene = activeScene(state);
    const ids = state.selection.length > 0 ? state.selection : Object.keys(scene?.entities ?? {});
    viewport.focus(ids);
  }, [focusToken, session]);

  const toggleGameView = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (!viewport.setViewMode(viewMode === 'game' ? 'editor' : 'game')) {
      notify('Добавьте в сцену камеру, чтобы посмотреть вид игры', 'error');
    }
  };

  return (
    <div className="ed-viewport ed-viewport--3d" data-testid="viewport" data-ready={ready}>
      <div
        ref={hostRef}
        className={`ed-viewport3d__host is-tool-${ui.tool}${viewMode === 'game' ? ' is-game' : ''}`}
        onDoubleClick={() => ui.focusSelection()}
      >
        <canvas
          ref={canvasRef}
          className="ed-viewport3d__canvas"
          data-testid="viewport-canvas"
          role="application"
          aria-label="3D-вьюпорт сцены"
        />
      </div>
      {!ready ? (
        <div className="ed-viewport3d__loading" aria-busy="true">
          Загружаем 3D-движок…
        </div>
      ) : null}
      <div className="ed-viewport__badge mono" aria-hidden="true">
        {viewMode === 'game' ? 'Вид игровой камеры' : 'Перспектива · клетка 1 м'}
      </div>
      <div className="ed-viewport__zoom" role="toolbar" aria-label="Вьюпорт">
        <button
          type="button"
          className={`ed-icon-btn${snap ? ' is-active' : ''}`}
          aria-pressed={snap}
          aria-label="Привязка"
          title="Привязка: 0,5 м · 15° · 0,1"
          onClick={() => setSnap((value) => !value)}
        >
          #
        </button>
        <button
          type="button"
          className="ed-icon-btn"
          aria-label="Показать выделенное"
          title="Показать выделенное (F)"
          disabled={!ready || viewMode === 'game'}
          onClick={() => ui.focusSelection()}
        >
          ⤢
        </button>
        <button
          type="button"
          className={`ed-icon-btn${viewMode === 'game' ? ' is-active' : ''}`}
          aria-pressed={viewMode === 'game'}
          aria-label="Камера игры"
          title={hasCamera ? 'Посмотреть через игровую камеру' : 'В сцене нет камеры'}
          disabled={!ready || (!hasCamera && viewMode !== 'game')}
          onClick={toggleGameView}
        >
          ◧
        </button>
      </div>
    </div>
  );
}
