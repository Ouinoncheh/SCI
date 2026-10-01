import { test, expect } from '@playwright/test';

test('interface moderne responsive et navigation accessible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/biens',
      '/biens/marseille-vauban',
      '/biens/nouveau',
      '/comparateur',
      '/connexion',
    ]) {
      await page.goto(route);
      await expect(page.locator('h1').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} à ${width}px`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(
    page
      .getByRole('navigation', { name: 'Navigation principale' })
      .locator('[aria-current="page"]'),
  ).toHaveCount(1);
  await page.screenshot({ path: 'test-results/refonte-dashboard-desktop.png', fullPage: true });
  await page.goto('/biens/marseille-vauban');
  await page.screenshot({ path: 'test-results/refonte-bien-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'test-results/refonte-bien-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 812, height: 375 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
