import { test, expect } from '@playwright/test';
test('brouillon assisté mobile sans débordement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/biens/nouveau');
  await page.getByLabel('URL de l’annonce').fill('https://agence.example.org/annonce/123456');
  await page.getByRole('button', { name: 'Analyser le bien', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compléter l’annonce' })).toBeVisible();
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('*'))
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
      .map((e) => ({ tag: e.tagName, class: e.className, width: e.getBoundingClientRect().width }))
      .slice(-15),
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    JSON.stringify(overflow),
  ).toBe(true);
});
