import { expect, test, type Page } from '@playwright/test';

import { entityPoint, handlePoint, mouseDrag, outward, waitForViewport } from './viewport.js';

const API = process.env.VITE_CREATOR_API_URL ?? 'http://127.0.0.1:3010';

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

async function createProject(page: Page, token: string, title: string): Promise<string> {
  const response = await page.request.post(`${API}/api/v1/projects`, {
    headers: { authorization: `Bearer ${token}` },
    data: { title, type: 'game3d', templateId: 'starter', orientation: 'auto' },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { projectId: string };
  return body.projectId;
}

async function deleteProject(page: Page, token: string, projectId: string): Promise<void> {
  await page.request.delete(`${API}/api/v1/projects/${projectId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function readDraft(page: Page, token: string, projectId: string) {
  const response = await page.request.get(`${API}/api/v1/projects/${projectId}/draft`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return (await response.json()) as {
    revision: number;
    document: {
      scenes: {
        rootEntityIds: string[];
        entities: Record<
          string,
          {
            name: string;
            parentId: string | null;
            components: { type: string; data: { position?: number[] } }[];
          }
        >;
      }[];
    };
  };
}

function row(page: Page, name: string) {
  return page.getByRole('treeitem', { name, exact: true });
}

test.describe('scene editor', () => {
  let token = '';
  let projectId = '';

  test.beforeEach(async ({ page }, testInfo) => {
    token = await login(page);
    projectId = await createProject(page, token, `Editor ${testInfo.project.name} ${Date.now()}`);
  });

  test.afterEach(async ({ page }) => {
    await deleteProject(page, token, projectId);
  });

  test('desktop: create, rename, transform, duplicate, reparent, delete, undo/redo, save, reload', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop workspace');
    await page.goto(`/projects/${projectId}`);
    await page.getByTestId('open-editor').click();
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeDisabled();
    // Nothing to save yet: no Save button at all.
    await expect(page.getByRole('button', { name: 'Сохранить' })).toHaveCount(0);

    // Create
    await page.getByRole('button', { name: '+ Объект' }).click();
    await page.getByRole('menuitem', { name: 'Сфера' }).click();
    await expect(row(page, 'Сфера')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'dirty');

    // Rename through the Inspector
    await page.getByTestId('inspector-name').fill('Шар');
    await page.getByTestId('inspector-name').press('Enter');
    await expect(row(page, 'Шар')).toBeVisible();

    // Transform through the Inspector
    const x = page.getByTestId('prop-transform-position-x');
    await x.fill('3,5');
    await x.press('Enter');
    await expect(x).toHaveValue('3.5');

    // Invalid value is rejected and the document is untouched
    const scaleX = page.getByTestId('prop-transform-scale-x');
    await scaleX.fill('abc');
    await scaleX.press('Enter');
    await expect(scaleX).toHaveAttribute('aria-invalid', 'true');
    await scaleX.press('Escape');

    // Duplicate (Ctrl+D) and reparent by dragging onto «Куб»
    await row(page, 'Шар').click();
    await page.keyboard.press('Control+d');
    await expect(row(page, 'Шар 2')).toHaveAttribute('aria-selected', 'true');
    await row(page, 'Шар 2').dragTo(row(page, 'Куб'));
    await expect(row(page, 'Шар 2')).toHaveAttribute('aria-level', '2');

    // Delete (desktop: immediate, undoable)
    await page.keyboard.press('Delete');
    await expect(row(page, 'Шар 2')).toHaveCount(0);

    // Undo restores delete, then reparent, then duplicate; Redo re-applies
    const undo = page.getByRole('button', { name: 'Отменить' });
    const redo = page.getByRole('button', { name: 'Повторить' });
    await undo.click();
    await expect(row(page, 'Шар 2')).toHaveAttribute('aria-level', '2');
    await undo.click();
    await expect(row(page, 'Шар 2')).toHaveAttribute('aria-level', '1');
    await page.keyboard.press('Control+z');
    await expect(row(page, 'Шар 2')).toHaveCount(0);
    await redo.click();
    await expect(row(page, 'Шар 2')).toBeVisible();
    await page.keyboard.press('Control+Shift+z');
    await expect(row(page, 'Шар 2')).toHaveAttribute('aria-level', '2');

    // Save → only "Сохранено" after the server answers; reload reads the same scene
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
    await expect(page.getByTestId('save-status')).toContainText('Сохранено');

    const draft = await readDraft(page, token, projectId);
    expect(draft.revision).toBe(2);
    const entities = Object.values(draft.document.scenes[0]?.entities ?? {});
    const ball = entities.find((entity) => entity.name === 'Шар');
    expect(
      ball?.components.find((component) => component.type === 'transform')?.data.position?.[0],
    ).toBe(3.5);
    const cubeId = Object.entries(draft.document.scenes[0]?.entities ?? {}).find(
      ([, entity]) => entity.name === 'Куб',
    )?.[0];
    expect(entities.find((entity) => entity.name === 'Шар 2')?.parentId).toBe(cubeId);

    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect(row(page, 'Шар 2')).toHaveAttribute('aria-level', '2');
    await row(page, 'Шар').click();
    await expect(page.getByTestId('prop-transform-position-x')).toHaveValue('3.5');
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeDisabled();
  });

  test('desktop: a gizmo drag in the 3D viewport is one undo step; conflict never overwrites silently', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop workspace');
    await page.goto(`/projects/${projectId}/edit`);
    await expect(page.getByTestId('editor')).toBeVisible();

    // Move tool; drag the X handle of the 3D gizmo in many small steps.
    await waitForViewport(page);
    await page.keyboard.press('w');
    await expect(page.getByRole('radio', { name: 'Перемещение' })).toBeChecked();
    await row(page, 'Куб').click();
    const center = await entityPoint(page, 'entity_cube');
    const handle = await handlePoint(page, 'x');
    await mouseDrag(page, handle, outward(center, handle, 0.9), 16);
    await expect(row(page, 'Куб')).toHaveAttribute('aria-selected', 'true');
    const x = page.getByTestId('prop-transform-position-x');
    await expect(x).not.toHaveValue('0');
    await page.getByRole('button', { name: 'Отменить' }).click();
    await expect(x).toHaveValue('0');
    await expect(page.getByRole('button', { name: 'Отменить' })).toBeDisabled();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');

    // Another device saves first
    const server = await readDraft(page, token, projectId);
    const changed = await page.request.put(`${API}/api/v1/projects/${projectId}/draft`, {
      headers: { authorization: `Bearer ${token}` },
      data: {
        baseRevision: server.revision,
        mutationId: `e2e_${Date.now()}`,
        document: server.document,
      },
    });
    expect(changed.status()).toBe(200);

    await page.getByTestId('prop-transform-position-z').fill('4');
    await page.getByTestId('prop-transform-position-z').press('Enter');
    await page.keyboard.press('Control+s');
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'conflict');
    await expect(page.getByTestId('conflict-banner')).toBeVisible();

    await page.getByRole('button', { name: 'Загрузить версию с сервера' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Загрузить' }).click();
    await expect(page.getByTestId('conflict-banner')).toHaveCount(0);
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
    await row(page, 'Куб').click();
    await expect(page.getByTestId('prop-transform-position-z')).toHaveValue('0');
  });

  test('mobile: the same edits work with taps only (sheets, no hardware keyboard)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile workspace');
    await page.goto(`/projects/${projectId}/edit`);
    await expect(page.getByTestId('editor')).toBeVisible();

    // Create via the + button
    await page.getByRole('button', { name: 'Добавить объект' }).tap();
    await page.getByTestId('sheet-add').getByRole('menuitem', { name: 'Куб' }).tap();
    await expect(page.getByTestId('selection-bar')).toContainText('Куб 2');

    // Transform in the Properties sheet
    await page.getByTestId('selection-bar').getByRole('button', { name: 'Свойства' }).tap();
    const sheet = page.getByTestId('sheet-inspector');
    await expect(sheet).toBeVisible();
    const y = sheet.getByTestId('prop-transform-position-y');
    await y.tap();
    await y.fill('2');
    await sheet.getByTestId('component-transform').getByText('Позиция').tap();
    await expect(y).toHaveValue('2');
    await sheet.getByRole('button', { name: 'Закрыть' }).tap();

    // Reparent via "Переместить в…"
    await page.getByRole('button', { name: 'Объекты', exact: true }).tap();
    const objects = page.getByTestId('sheet-hierarchy');
    await objects.getByRole('button', { name: 'Действия: Куб 2' }).tap();
    await objects.getByRole('menuitem', { name: 'Переместить в…' }).tap();
    await page.getByRole('option', { name: 'Земля' }).tap();
    await expect(row(page, 'Куб 2')).toHaveAttribute('aria-level', '2');

    // Rename via the row menu
    await objects.getByRole('button', { name: 'Действия: Куб 2' }).tap();
    await objects.getByRole('menuitem', { name: 'Переименовать' }).tap();
    const rename = objects.getByRole('textbox', { name: 'Новое имя для «Куб 2»' });
    await rename.fill('Ящик');
    await rename.press('Enter');
    await expect(row(page, 'Ящик')).toBeVisible();
    await objects.getByRole('button', { name: 'Закрыть' }).tap();

    // Duplicate and delete (with confirmation) from the selection bar, then undo
    await page.getByTestId('selection-bar').getByRole('button', { name: 'Дублировать' }).tap();
    await expect(page.getByTestId('selection-bar')).toContainText('Ящик 2');
    await page.getByTestId('selection-bar').getByRole('button', { name: 'Удалить' }).tap();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).tap();
    await expect(page.getByTestId('selection-bar')).toHaveCount(0);
    await page.getByRole('button', { name: 'Отменить' }).tap();
    await expect(page.getByTestId('selection-bar')).toContainText('Ящик 2');

    // Save from the top bar
    await page.getByRole('button', { name: 'Сохранить' }).tap();
    await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
    const draft = await readDraft(page, token, projectId);
    const names = Object.values(draft.document.scenes[0]?.entities ?? {}).map(
      (entity) => entity.name,
    );
    expect(names).toEqual(expect.arrayContaining(['Ящик', 'Ящик 2']));
  });
});
