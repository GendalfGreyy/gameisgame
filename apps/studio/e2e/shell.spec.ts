import { expect, test } from '@playwright/test';

test('studio shell shows editor chrome without player-only layout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('studio-shell')).toBeVisible();
  await expect(page.getByTestId('studio-hierarchy')).toBeVisible();
  await expect(page.getByTestId('studio-inspector')).toBeVisible();
  await expect(page.getByTestId('studio-viewport')).toContainText('Viewport');
  await expect(page.getByText('TG Creator Studio')).toBeVisible();
});
