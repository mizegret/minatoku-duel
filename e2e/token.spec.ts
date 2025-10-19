import { test, expect } from '@playwright/test';

test('token status indicator renders', async ({ page }) => {
  await page.goto('/');
  // ヘッダの token: 表示が出ていること（値は '...' or ok/fail どれでも可）
  const el = page.locator('text=token:');
  await expect(el).toBeVisible();
});
