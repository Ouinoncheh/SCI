import { expect, test } from '@playwright/test';

test('dashboard, catalogue et favoris', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Une vision claire. Des choix éclairés.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Tous les biens', exact: true }).click();
  await page.getByRole('textbox', { name: 'Rechercher un bien' }).fill('Angers');
  await expect(page.locator('.property-card')).toHaveCount(1);
  const favorite = page.getByRole('button', {
    name: 'Retirer des favoris : Le charme de la Doutre',
  });
  await favorite.click();
  await expect(
    page.getByRole('button', { name: 'Ajouter aux favoris : Le charme de la Doutre' }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Favoris', { exact: true }).check();
  await expect(page.getByText('Aucun bien ne correspond')).toBeVisible();
});

test('simulation, échéancier exportable, projections et fiscalité absente', async ({ page }) => {
  await page.goto('/biens/marseille-vauban');
  const before = await page.locator('.hero-metrics').innerText();
  await page.getByRole('tab', { name: 'Hypothèses', exact: true }).click();
  await page.getByLabel('Loyer mensuel hors charges').fill('1500');
  await page.getByRole('button', { name: 'Recalculer l’analyse' }).click();
  await expect(page.locator('.hero-metrics')).not.toHaveText(before);
  await page.getByRole('tab', { name: 'Crédit', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(240);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter CSV' }).click();
  expect((await download).suggestedFilename()).toBe('echeancier-marseille-vauban.csv');
  await page.getByRole('tab', { name: 'Projection', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('button', { name: 'Prudent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Prudent', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('tab', { name: 'Fiscalité & marché', exact: true }).click();
  await expect(page.getByText('Donnée indisponible', { exact: true }).first()).toBeVisible();
});

test('comparateur et état vide', async ({ page }) => {
  await page.goto('/comparateur');
  await expect(page.locator('.comparison-table')).toBeVisible();
  await expect(page.locator('.comparison-table thead th')).toHaveCount(4);
  await page.getByRole('checkbox', { name: /Angers/ }).uncheck();
  await page.getByRole('checkbox', { name: /Lyon/ }).uncheck();
  await expect(
    page.getByRole('heading', { name: 'Sélectionnez au moins deux biens' }),
  ).toBeVisible();
});

test('import de texte et création temporaire sans information inventée', async ({ page }) => {
  await page.goto('/biens/nouveau');
  await page.getByLabel('Texte de l’annonce').fill('Appartement 50 m², prix 150 000 €');
  await page.getByRole('button', { name: 'Extraire le prix et la surface' }).click();
  await expect(page.getByLabel('Prix d’achat')).toHaveValue('150000');
  await page.getByLabel('Nom du bien').fill('Mon étude temporaire');
  await page.getByLabel('Ville', { exact: true }).fill('Nantes');
  await page.getByLabel('Code postal').fill('44000');
  await page.getByLabel('Loyer mensuel hors charges').fill('900');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Créer l’analyse temporaire' }).click();
  await expect(page.getByRole('heading', { name: 'Mon étude temporaire' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bien introuvable' })).toBeVisible();
});

test('navigation mobile sans débordement horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ['/', '/biens', '/biens/marseille-vauban', '/comparateur']) {
    await page.goto(url);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test('API publique exclusivement fictive', async ({ request }) => {
  const response = await request.get('/api/demo/properties');
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.synthetic).toBe(true);
  expect(body.properties).toHaveLength(4);
  expect(body.properties[0].analysis.afterTaxYield).toBeNull();
  expect((await request.post('/api/demo/properties', { data: {} })).status()).toBe(405);
});
