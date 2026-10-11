import { expect, test, type Page } from '@playwright/test';

import {
  cameraState,
  canvasColourCount,
  entityPoint,
  handlePoint,
  mouseDrag,
  outward,
  tangent,
  touchGesture,
  waitForViewport,
} from './viewport.js';

const API = process.env.VITE_CREATOR_API_URL ?? 'http://127.0.0.1:3010';
const SCREENSHOTS = process.env.SCREENSHOT_DIR ?? 'test-results/screenshots';

type Draft = {
  revision: number;
  document: {
    assetRefs: { id: string; kind: string }[];
    scenes: {
      entities: Record<
        string,
        {
          name: string;
          components: { type: string; data: Record<string, unknown> }[];
        }
      >;
    }[];
  };
};

async function login(page: Page): Promise<string> {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('/');
  await page.getByRole('radio', { name: 'Пользователь A' }).click();
  await page.getByTestId('dev-login').click();
  await expect(page.getByTestId('dashboard')).toBeVisible();
  const token = await page.evaluate(() => window.localStorage.getItem('tgc.session'));
  if (!token) throw new Error('no session token');
  return token;
}

async function readDraft(page: Page, token: string, projectId: string): Promise<Draft> {
  const response = await page.request.get(`${API}/api/v1/projects/${projectId}/draft`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return (await response.json()) as Draft;
}

function component(draft: Draft, entityId: string, type: string): Record<string, unknown> {
  const found = draft.document.scenes[0]?.entities[entityId]?.components.find(
    (item) => item.type === type,
  );
  if (!found) throw new Error(`${entityId} has no ${type}`);
  return found.data;
}

function row(page: Page, name: string) {
  return page.getByRole('treeitem', { name, exact: true });
}

function vec(page: Page, key: string) {
  return {
    x: page.getByTestId(`prop-transform-${key}-x`),
    y: page.getByTestId(`prop-transform-${key}-y`),
    z: page.getByTestId(`prop-transform-${key}-z`),
  };
}

async function numberOf(locator: ReturnType<Page['getByTestId']>): Promise<number> {
  return Number((await locator.inputValue()).replace(',', '.'));
}

test.describe('3D viewport (PlayCanvas)', () => {
  let token = '';
  let projectId = '';

  test.beforeEach(async ({ page }, testInfo) => {
    token = await login(page);
    const response = await page.request.post(`${API}/api/v1/projects`, {
      headers: { authorization: `Bearer ${token}` },
      data: {
        title: `3D ${testInfo.project.name} ${Date.now()}`,
        type: 'game3d',
        templateId: 'starter',
        orientation: 'auto',
      },
    });
    expect(response.status()).toBe(201);
    projectId = ((await response.json()) as { projectId: string }).projectId;
  });

  test.afterEach(async ({ page }) => {
    await page.request.delete(`${API}/api/v1/projects/${projectId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  });

  test('desktop: pick, move, rotate, scale, material, undo/redo, save, reopen', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop workspace');
    await page.goto(`/projects/${projectId}/edit`);
    await waitForViewport(page);

    // Smoke: the canvas really renders the scene (not a blank WebGL surface).
    const canvas = page.getByTestId('viewport-canvas');
    const shot = await canvas.screenshot({ path: `${SCREENSHOTS}/viewport-desktop.png` });
    expect(await canvasColourCount(page, shot)).toBeGreaterThan(12);

    // Mouse pick
    const cubePoint = await entityPoint(page, 'entity_cube');
    await page.mouse.click(cubePoint.x, cubePoint.y);
    await expect(row(page, 'Куб')).toHaveAttribute('aria-selected', 'true');
    // A click on empty sky clears the selection; the hierarchy selects back.
    const sky = await page.getByTestId('viewport-canvas').boundingBox();
    if (!sky) throw new Error('canvas hidden');
    await page.mouse.click(sky.x + sky.width / 2, sky.y + 12);
    await expect(row(page, 'Куб')).toHaveAttribute('aria-selected', 'false');
    await row(page, 'Куб').click();

    // Move along X with the gizmo
    await page.keyboard.press('w');
    const center = await entityPoint(page, 'entity_cube');
    const moveX = await handlePoint(page, 'x');
    await mouseDrag(page, moveX, outward(center, moveX, 0.9));
    const position = vec(page, 'position');
    await expect(position.x).not.toHaveValue('0');
    await expect(position.y).toHaveValue('1');
    await expect(position.z).toHaveValue('0');
    const movedX = await numberOf(position.x);

    // Rotate around Y
    await page.keyboard.press('e');
    await expect(page.getByRole('radio', { name: 'Поворот' })).toBeChecked();
    const rotateCenter = await entityPoint(page, 'entity_cube');
    const ringY = await handlePoint(page, 'y');
    await mouseDrag(page, ringY, tangent(rotateCenter, ringY, 90));
    const rotation = vec(page, 'rotationEuler');
    await expect(rotation.y).not.toHaveValue('0');
    const rotatedY = await numberOf(rotation.y);

    // Scale along local X
    await page.keyboard.press('r');
    const scaleCenter = await entityPoint(page, 'entity_cube');
    const scaleX = await handlePoint(page, 'x');
    await mouseDrag(page, scaleX, outward(scaleCenter, scaleX, 1.2));
    const scale = vec(page, 'scale');
    await expect(scale.x).not.toHaveValue('1');
    await expect(scale.y).toHaveValue('1');
    const scaledX = await numberOf(scale.x);
    expect(scaledX).toBeGreaterThan(1);

    // Material colour (hex field) and roughness
    const colour = page.getByTestId('prop-material-baseColor');
    await colour.fill('#FF5500');
    await colour.press('Enter');
    await expect(colour).toHaveValue('#FF5500');

    // Each gizmo drag is exactly one undo step.
    const undo = page.getByRole('button', { name: 'Отменить' });
    const redo = page.getByRole('button', { name: 'Повторить' });
    await undo.click();
    await expect(colour).toHaveValue('#D4F24A');
    await undo.click();
    await expect(scale.x).toHaveValue('1');
    await undo.click();
    await expect(rotation.y).toHaveValue('0');
    await undo.click();
    await expect(position.x).toHaveValue('0');
    await expect(undo).toBeDisabled();
    for (let step = 0; step < 4; step += 1) {
      await redo.click();
    }
    await expect(position.x).toHaveValue(String(movedX));
    await expect(rotation.y).toHaveValue(String(rotatedY));
    await expect(scale.x).toHaveValue(String(scaledX));
    await expect(colour).toHaveValue('#FF5500');

    // Viewport follows the document: after undo the cube is drawn back at the origin.
    await page.keyboard.press('Control+s');
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
    const draft = await readDraft(page, token, projectId);
    const transform = component(draft, 'entity_cube', 'transform');
    expect(transform.position).toEqual([movedX, 1, 0]);
    expect((transform.rotationEuler as number[])[1]).toBe(rotatedY);
    expect((transform.scale as number[])[0]).toBe(scaledX);
    expect(component(draft, 'entity_cube', 'material').baseColor).toBe('#FF5500');

    // Orbit on empty space moves the editor camera only.
    const before = await cameraState(page);
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas hidden');
    await mouseDrag(page, { x: box.x + 40, y: box.y + 40 }, { x: box.x + 200, y: box.y + 90 });
    expect(await cameraState(page)).not.toEqual(before);
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
    const orbited = await cameraState(page);

    // Reopen: the same parameters come back from the server; the editor camera from this device.
    await page.reload();
    await waitForViewport(page);
    await row(page, 'Куб').click();
    await expect(position.x).toHaveValue(String(movedX));
    await expect(rotation.y).toHaveValue(String(rotatedY));
    await expect(scale.x).toHaveValue(String(scaledX));
    await expect(colour).toHaveValue('#FF5500');
    expect(await cameraState(page)).toEqual(orbited);
    await canvas.screenshot({ path: `${SCREENSHOTS}/viewport-desktop-edited.png` });

    // Game camera view hides gizmos and stops editor gestures.
    const gameView = page.getByRole('button', { name: 'Камера игры' });
    await gameView.click();
    await expect(gameView).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('viewport')).toContainText('Вид игровой камеры');
    await canvas.screenshot({ path: `${SCREENSHOTS}/viewport-desktop-game-camera.png` });
    await gameView.click();
    await expect(gameView).toHaveAttribute('aria-pressed', 'false');
  });

  test('desktop: built-in model from the add menu, swap back to a primitive', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop workspace');
    await page.goto(`/projects/${projectId}/edit`);
    await waitForViewport(page);
    await page.getByRole('button', { name: '+ Объект' }).click();
    await page.getByRole('menuitem', { name: 'Дерево' }).click();
    await expect(row(page, 'Дерево')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('prop-mesh-assetId')).toHaveValue('builtin_tree');

    await page.keyboard.press('Control+s');
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
    const draft = await readDraft(page, token, projectId);
    expect(draft.document.assetRefs.map((asset) => asset.id)).toContain('builtin_tree');
    const treeId = Object.entries(draft.document.scenes[0]?.entities ?? {}).find(
      ([, entity]) => entity.name === 'Дерево',
    )?.[0];
    if (!treeId) throw new Error('tree not saved');
    // The GLB is parsed by PlayCanvas and replaces the placeholder primitive.
    await expect
      .poll(() => page.evaluate((id) => window.__tgcViewport?.hasLoadedModel(id) ?? false, treeId))
      .toBe(true);
    await page.getByTestId('viewport-canvas').screenshot({
      path: `${SCREENSHOTS}/viewport-desktop-tree.png`,
    });

    // One undo removes both the object and its asset reference.
    await page.getByRole('button', { name: 'Отменить' }).click();
    await expect(row(page, 'Дерево')).toHaveCount(0);
    await page.getByRole('button', { name: 'Повторить' }).click();
    await page.getByTestId('prop-mesh-assetId').selectOption('');
    await expect(page.getByTestId('prop-mesh-assetId')).toHaveValue('');
    expect(
      await page.evaluate((id) => window.__tgcViewport?.hasLoadedModel(id) ?? true, treeId),
    ).toBe(false);
    await page.getByTestId('viewport-canvas').screenshot({
      path: `${SCREENSHOTS}/viewport-desktop-model.png`,
    });
  });

  test('mobile: tap to pick, drag the gizmo with a finger, pinch never edits', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile workspace');
    await page.goto(`/projects/${projectId}/edit`);
    await waitForViewport(page);
    const canvas = page.getByTestId('viewport-canvas');
    const shot = await canvas.screenshot({ path: `${SCREENSHOTS}/viewport-mobile.png` });
    expect(await canvasColourCount(page, shot)).toBeGreaterThan(12);

    const cube = await entityPoint(page, 'entity_cube');
    await page.touchscreen.tap(cube.x, cube.y);
    await expect(page.getByTestId('selection-bar')).toContainText('Куб');

    // Finger drag on the move handle: one undoable edit.
    await expect(page.getByRole('radio', { name: 'Перемещение' })).toBeChecked();
    const center = await entityPoint(page, 'entity_cube');
    const handle = await handlePoint(page, 'x');
    await touchGesture(page, [{ from: handle, to: outward(center, handle, 0.9) }]);
    const undo = page.getByRole('button', { name: 'Отменить' });
    await expect(undo).toBeEnabled();

    await page.getByTestId('selection-bar').getByRole('button', { name: 'Свойства' }).tap();
    const sheet = page.getByTestId('sheet-inspector');
    const x = sheet.getByTestId('prop-transform-position-x');
    await expect(x).not.toHaveValue('0');
    const movedX = await x.inputValue();
    await sheet.getByRole('button', { name: 'Закрыть' }).tap();

    // Pinch whose second finger lands on the gizmo: camera zooms, the cube stays put.
    const before = await cameraState(page);
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas hidden');
    const handleNow = await handlePoint(page, 'x');
    await touchGesture(page, [
      { from: { x: box.x + 30, y: box.y + 40 }, to: { x: box.x + 10, y: box.y + 20 } },
      { from: handleNow, to: { x: handleNow.x + 60, y: handleNow.y + 60 } },
    ]);
    expect(await cameraState(page)).not.toEqual(before);
    // One-finger orbit on empty space
    await touchGesture(page, [
      { from: { x: box.x + 30, y: box.y + 60 }, to: { x: box.x + 140, y: box.y + 90 } },
    ]);

    await page.getByTestId('selection-bar').getByRole('button', { name: 'Свойства' }).tap();
    await expect(sheet.getByTestId('prop-transform-position-x')).toHaveValue(movedX);
    await sheet.getByRole('button', { name: 'Закрыть' }).tap();

    // Single undo step for the drag; then redo and save.
    await undo.tap();
    await expect(undo).toBeDisabled();
    await page.getByRole('button', { name: 'Повторить' }).tap();
    await page.getByRole('button', { name: 'Сохранить' }).tap();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
    const draft = await readDraft(page, token, projectId);
    expect((component(draft, 'entity_cube', 'transform').position as number[])[0]).toBe(
      Number(movedX),
    );
    await canvas.screenshot({ path: `${SCREENSHOTS}/viewport-mobile-edited.png` });
  });
});
