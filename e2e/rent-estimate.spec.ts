import { test, expect } from '@playwright/test';
test('loyer local mobile, charges, transfert et erreur non bloquante', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/biens/nouveau');
  await page.getByLabel('Ville', { exact: true }).fill('Marseille');
  await page.getByLabel('Code postal', { exact: true }).fill('13006');
  await page.getByLabel(/^Surface/).fill('60');
  await page.getByLabel(/^Prix d’achat/).fill('200000');
  await page.getByLabel(/^Type de logement/).selectOption('APARTMENT');
  await page
    .getByLabel('Charges récupérables mensuelles estimées (€)', { exact: true })
    .fill('100');
  await page.getByRole('button', { name: 'Rechercher le loyer local' }).click();
  await expect(page.getByRole('heading', { name: 'Central', exact: true })).toBeVisible();
  const response = await request.get(
    '/api/market/rent?postcode=13006&city=Marseille&kind=APARTMENT',
  );
  expect(response.ok()).toBe(true);
  const { reference } = await response.json();
  expect(reference.code).toBe('13206');
  const expected =
    Math.round((Math.round(60 * reference.perSquareMeter * 100) / 100 - 100) * 100) / 100;
  await page.getByRole('button', { name: 'Utiliser ce loyer', exact: true }).nth(1).click();
  await expect(page.getByLabel(/^Loyer mensuel hors charges/)).toHaveValue(String(expected));
  await expect(page.getByText('Cash-flow mensuel avant impôt', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .locator('fieldset')
    .filter({ has: page.locator('legend', { hasText: 'Estimer le loyer' }) })
    .screenshot({ path: 'test-results/rent-panel.png' });
  await page.getByLabel('Code postal', { exact: true }).fill('13340');
  await expect(page.getByRole('button', { name: 'Utiliser ce loyer', exact: true })).toHaveCount(0);
  await page.route('**/api/market/rent?**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Référence temporairement indisponible.' }),
    }),
  );
  await page.getByRole('button', { name: 'Rechercher le loyer local' }).click();
  await expect(
    page.getByText('Référence temporairement indisponible.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Loyer mensuel hors charges/)).toHaveValue(String(expected));
});
