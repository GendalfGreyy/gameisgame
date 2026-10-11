import { expect, type Page } from '@playwright/test';

export type Point = { x: number; y: number };
type Axis = 'x' | 'y' | 'z';

declare global {
  interface Window {
    /** Exposed by the studio in dev builds (src/editor/Viewport3D.tsx). */
    __tgcViewport?: {
      screenPoint(entityId: string): Point | null;
      gizmoHandlePoint(axis: Axis): Point | null;
      getCamera(): unknown;
      hasLoadedModel(entityId: string): boolean;
    };
  }
}

export async function waitForViewport(page: Page): Promise<void> {
  await expect(page.getByTestId('viewport')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000,
  });
}

async function canvasOrigin(page: Page): Promise<Point> {
  const box = await page.getByTestId('viewport-canvas').boundingBox();
  if (!box) throw new Error('viewport canvas is not visible');
  return { x: box.x, y: box.y };
}

/** Page coordinates of an entity's visual centre in the 3D viewport. */
export async function entityPoint(page: Page, entityId: string): Promise<Point> {
  const origin = await canvasOrigin(page);
  const point = await page.evaluate(
    (id) => window.__tgcViewport?.screenPoint(id) ?? null,
    entityId,
  );
  if (!point) throw new Error(`entity ${entityId} is not on screen`);
  return { x: origin.x + point.x, y: origin.y + point.y };
}

/** Page coordinates of a gizmo handle of the active tool. */
export async function handlePoint(page: Page, axis: Axis): Promise<Point> {
  const origin = await canvasOrigin(page);
  const point = await page.evaluate((a) => window.__tgcViewport?.gizmoHandlePoint(a) ?? null, axis);
  if (!point) throw new Error(`gizmo handle ${axis} is not on screen`);
  return { x: origin.x + point.x, y: origin.y + point.y };
}

export async function cameraState(page: Page): Promise<unknown> {
  return page.evaluate(() => window.__tgcViewport?.getCamera() ?? null);
}

/** Drag the way a gizmo expects: press, several moves, release. */
export async function mouseDrag(page: Page, from: Point, to: Point, steps = 10): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
  }
  await page.mouse.up();
}

type Touch = { x: number; y: number; id: number };

/** Multi-touch gesture through CDP (Playwright's touchscreen only taps). */
export async function touchGesture(
  page: Page,
  paths: { from: Point; to: Point }[],
  steps = 10,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const at = (t: number): Touch[] =>
    paths.map((path, id) => ({
      id,
      x: path.from.x + (path.to.x - path.from.x) * t,
      y: path.from.y + (path.to.y - path.from.y) * t,
    }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
  for (let step = 1; step <= steps; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: at(step / steps),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Continue the line centre → handle outward by `factor` of its length. */
export function outward(center: Point, handle: Point, factor: number): Point {
  return {
    x: handle.x + (handle.x - center.x) * factor,
    y: handle.y + (handle.y - center.y) * factor,
  };
}

/** A point beside the handle, perpendicular to centre → handle (drags along a rotate ring). */
export function tangent(center: Point, handle: Point, pixels: number): Point {
  const dx = handle.x - center.x;
  const dy = handle.y - center.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: handle.x - (dy / length) * pixels, y: handle.y + (dx / length) * pixels };
}

/**
 * Counts distinct coarse colours in a screenshot of the canvas: a blank or failed WebGL
 * canvas has one or two, a rendered scene has many.
 */
export async function canvasColourCount(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) return 0;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const colours = new Set<number>();
    for (let index = 0; index < data.length; index += 4 * 7) {
      const r = (data[index] ?? 0) >> 4;
      const g = (data[index + 1] ?? 0) >> 4;
      const b = (data[index + 2] ?? 0) >> 4;
      colours.add((r << 8) | (g << 4) | b);
    }
    return colours.size;
  }, png.toString('base64'));
}
