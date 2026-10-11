import { expect, test, type Page } from '@playwright/test';

async function loginAs(page: Page, user: 'A' | 'B') {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('/');
  await expect(page.getByTestId('auth-screen')).toBeVisible();
  await page.getByRole('radio', { name: `Пользователь ${user}` }).click();
  await page.getByTestId('dev-login').click();
  await expect(page.getByTestId('dashboard')).toBeVisible();
}

test('create a project in the wizard; it survives reload and is private to its owner', async ({
  page,
}, testInfo) => {
  const title = `E2E ${testInfo.project.name} ${Date.now()}`;
  await loginAs(page, 'A');

  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('wizard')).toBeVisible();
  await page.getByTestId('wizard-type-game3d').click();
  await page.getByTestId('wizard-template-starter').click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-title').fill(title);
  await page.getByRole('radio', { name: 'Портрет' }).click();
  await page.getByTestId('wizard-create').click();

  await expect(page.getByTestId('project-title')).toHaveText(title);
  await expect(page.getByTestId('project-structure')).toContainText('Куб');
  const projectUrl = page.url();

  await page.reload();
  await expect(page.getByTestId('project-title')).toHaveText(title);

  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Поиск по названию' }).fill(title);
  await expect(page.getByTestId('project-card').filter({ hasText: title })).toHaveCount(1);

  await loginAs(page, 'B');
  await page.getByRole('searchbox', { name: 'Поиск по названию' }).fill(title);
  await expect(page.getByTestId('project-card').filter({ hasText: title })).toHaveCount(0);
  await page.goto(projectUrl);
  await expect(page.getByRole('heading', { name: 'Проект не найден' })).toBeVisible();
});

test('wizard validates the title before creating', async ({ page }) => {
  await loginAs(page, 'A');
  await page.getByTestId('create-project').click();
  await page.getByTestId('wizard-type-app').click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-title').fill('   ');
  await page.getByTestId('wizard-create').click();
  await expect(page.getByText('Введите название')).toBeVisible();
  await expect(page.getByTestId('wizard')).toBeVisible();
});

test('theme switch applies immediately and is stored in the account', async ({ page }) => {
  await loginAs(page, 'A');
  await page.goto('/settings');
  const bg = () =>
    page.evaluate(() => document.documentElement.style.getPropertyValue('--ui-bg').trim());

  await page.getByTestId('theme-dark').click();
  await expect(page.getByTestId('sync-status')).toHaveText('Сохранено в аккаунте');
  expect(await bg()).toBe('#0E0E0C');

  await page.getByTestId('theme-light').click();
  await expect(page.getByTestId('sync-status')).toHaveText('Сохранено в аккаунте');
  expect(await bg()).toBe('#F3F1EA');
  await expect(page.getByTestId('theme-current')).toContainText('светлая');

  // Drop the device copy: the server preference must restore the theme.
  await page.evaluate(() => window.localStorage.removeItem('tgc.theme'));
  await page.reload();
  await expect(page.getByTestId('settings')).toBeVisible();
  await expect.poll(bg).toBe('#F3F1EA');
  await expect(page.getByTestId('theme-light')).toHaveAttribute('aria-checked', 'true');

  await page.getByTestId('theme-telegram').click();
  await expect(page.getByTestId('sync-status')).toHaveText('Сохранено в аккаунте');
});
