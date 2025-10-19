import { test, expect } from '@playwright/test';

test.describe('UI basics (100vh, events)', () => {
  test('full viewport with no page scroll and event logging', async ({ page }) => {
    await page.goto('/');

    // 100vh: ページ全体スクロールが発生しない
    await expect
      .poll(async () => {
        return await page.evaluate(() => ({
          scrollH: document.documentElement.scrollHeight,
          clientH: document.documentElement.clientHeight,
          bodyH: document.body.scrollHeight,
        }));
      })
      .toMatchObject({});
    const { scrollH, clientH, bodyH } = await page.evaluate(() => ({
      scrollH: document.documentElement.scrollHeight,
      clientH: document.documentElement.clientHeight,
      bodyH: document.body.scrollHeight,
    }));
    expect(scrollH).toBeLessThanOrEqual(clientH + 2);
    expect(bodyH).toBeLessThanOrEqual(clientH + 2);

    // join / start / move のログがカウントに反映される
    await page.getByRole('button', { name: 'join' }).click();
    await page.getByRole('button', { name: 'start' }).click();
    // 矢印キーを数回送る
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');

    const countsText = await page.locator('text=counts:').innerText();
    expect(countsText).toMatch(/join\s+\d+/);
    expect(countsText).toMatch(/start\s+\d+/);
    expect(countsText).toMatch(/move\s+\d+/);
  });
});
