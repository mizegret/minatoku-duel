import { test, expect } from '@playwright/test';

test.skip('プレースホルダー: まだアプリがないためスキップ', async ({ page }) => {
  await page.goto('about:blank');
  await expect(page).toBeDefined();
});
