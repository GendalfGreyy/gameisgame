import type { StudioScene } from '@game-is-game/shared';
import { useEffect, useRef } from 'react';

import { drawScene, pickEntityAt, type StudioRuntime } from './engine.js';

type EditorProps = {
  mode: 'edit';
  scene: StudioScene;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
};

type PlayProps = {
  mode: 'play';
  runtime: StudioRuntime;
};

type Props = (EditorProps | PlayProps) & {
  className?: string;
};

function fitScale(cssW: number, cssH: number, worldW: number, worldH: number) {
  const scale = Math.min(cssW / worldW, cssH / worldH);
  const ox = (cssW - worldW * scale) / 2;
  const oy = (cssH - worldH * scale) / 2;
  return { scale, ox, oy };
}

export function SceneCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = parent.clientWidth;
      const cssH = Math.max(240, Math.round(cssW * 0.64));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const ctx = canvas.getContext('2d');
      const current = propsRef.current;
      if (!ctx) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;

      if (current.mode === 'play') {
        const dt = Math.min(2, (now - last) / (1000 / 60));
        last = now;
        current.runtime.step(dt);
        const scene = current.runtime.getScene();
        const player = scene.entities.find((e) => e.behaviors.includes('player'));
        const viewW = cssW;
        const viewH = cssH;
        const camX = player
          ? Math.max(
              0,
              Math.min(Math.max(0, scene.world.width - viewW), player.x + player.w / 2 - viewW / 2),
            )
          : 0;
        const camY = player
          ? Math.max(
              0,
              Math.min(
                Math.max(0, scene.world.height - viewH),
                player.y + player.h / 2 - viewH / 2,
              ),
            )
          : 0;
        drawScene(ctx, scene, {
          showSpawn: false,
          cameraX: camX,
          cameraY: camY,
          viewWidth: cssW,
          viewHeight: cssH,
        });
      } else {
        const scene = current.scene;
        const { scale, ox, oy } = fitScale(cssW, cssH, scene.world.width, scene.world.height);
        ctx.save();
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.fillStyle = '#050d12';
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);
        drawScene(ctx, scene, {
          selectedId: current.selectedId,
          showSpawn: true,
          cameraX: 0,
          cameraY: 0,
        });
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 2 / scale;
        ctx.strokeRect(0, 0, scene.world.width, scene.world.height);
        ctx.restore();
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const toWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const current = propsRef.current;
    if (!canvas || current.mode !== 'edit') return null;
    const rect = canvas.getBoundingClientRect();
    const { scale, ox, oy } = fitScale(
      rect.width,
      rect.height,
      current.scene.world.width,
      current.scene.world.height,
    );
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  };

  if (props.mode === 'edit') {
    return (
      <canvas
        ref={canvasRef}
        className={`touch-none rounded-2xl ${props.className ?? ''}`}
        onPointerDown={(ev) => {
          const world = toWorld(ev.clientX, ev.clientY);
          if (!world || props.mode !== 'edit') return;
          const hit = pickEntityAt(props.scene, world.x, world.y);
          props.onSelect(hit?.id ?? null);
          if (hit) {
            dragRef.current = {
              id: hit.id,
              offsetX: world.x - hit.x,
              offsetY: world.y - hit.y,
            };
            (ev.target as HTMLCanvasElement).setPointerCapture(ev.pointerId);
          }
        }}
        onPointerMove={(ev) => {
          const drag = dragRef.current;
          if (!drag || props.mode !== 'edit') return;
          const world = toWorld(ev.clientX, ev.clientY);
          if (!world) return;
          const entity = props.scene.entities.find((e) => e.id === drag.id);
          if (!entity) return;
          const x = Math.max(
            0,
            Math.min(props.scene.world.width - entity.w, world.x - drag.offsetX),
          );
          const y = Math.max(
            0,
            Math.min(props.scene.world.height - entity.h, world.y - drag.offsetY),
          );
          props.onMove(drag.id, Math.round(x), Math.round(y));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
      />
    );
  }

  return <canvas ref={canvasRef} className={`touch-none rounded-2xl ${props.className ?? ''}`} />;
}
