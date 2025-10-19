import { test, expect } from '@playwright/test';

test('layout is 100vh and panels visible', async ({ page }) => {
  await page.goto('/');
  const { scrollH, clientH } = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
  }));
  expect(scrollH).toBeLessThanOrEqual(clientH + 2);
  await expect(page.getByText('Room')).toBeVisible();
  await expect(page.getByText('Players')).toBeVisible();
});
