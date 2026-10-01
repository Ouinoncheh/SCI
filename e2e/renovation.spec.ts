import { test, expect } from '@playwright/test';
test('budget détaillé temporaire et comparateur sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/biens/marseille-vauban');
  await page.getByRole('tab', { name: 'Travaux & scénarios', exact: true }).click();
  await page.getByLabel('Nom du scénario').fill('Rafraîchissement');
  await page.getByLabel('Imprévus travaux (%)').fill('10');
  await page.getByRole('button', { name: 'Ajouter un poste travaux' }).click();
  const item = page.getByRole('group', { name: 'Poste 1' });
  await item.getByLabel('Libellé').fill('Peinture du salon');
  await item.getByLabel('Quantité').fill('20');
  await item.getByLabel('Unité', { exact: true }).selectOption('m²');
  await item.getByLabel('Prix unitaire minimum TTC (€)').fill('15');
  await item.getByLabel('Prix unitaire maximum TTC (€)').fill('25');
  await expect(page.locator('.budget-preview')).toContainText('440');
  await item.locator('summary').filter({ hasText: 'Devis et dépenses' }).click();
  await item.getByLabel('Entreprise / artisan').fill('Artisan test');
  await item.getByLabel('Référence du devis', { exact: true }).fill('DEV-01');
  await item.getByLabel('État du devis').selectOption('ACCEPTED');
  await item.getByRole('button', { name: 'Ajouter un paiement' }).click();
  await item.getByLabel('Libellé du paiement').fill('Facture peinture');
  await item.getByLabel('Montant payé TTC (€)').fill('470');
  await item.getByLabel('Date du paiement').fill('2026-10-01');
  await item.getByLabel('Référence facture / paiement').fill('FAC-01');
  await item.getByLabel('Poste soldé', { exact: false }).check();
  await expect(page.locator('.budget-preview .spending-summary')).toContainText(
    'Dépassement du budget',
  );
  await expect(page.locator('.budget-preview .spending-summary')).toContainText(
    'Coût final déclaré',
  );
  await page.getByRole('button', { name: 'Enregistrer le scénario', exact: true }).click();
  await expect(page.locator('.saved-budget')).toHaveCount(1);
  await expect(page.locator('.saved-budget .spending-summary')).toContainText('470');
  const row = page.locator('.budget-table tbody tr').last();
  await expect(row).toContainText('Rafraîchissement');
  await expect(row).toContainText('440');
  await page
    .locator('.saved-budget')
    .getByRole('button', { name: 'Dupliquer', exact: true })
    .click();
  await page.getByLabel('Nom du scénario').fill('Premium');
  await expect(page.locator('.budget-preview .spending-summary')).toContainText(
    'Paiements saisis : 0',
  );
  await page
    .getByRole('group', { name: 'Poste 1' })
    .getByLabel('Prix unitaire maximum TTC (€)')
    .fill('45');
  await page.getByRole('button', { name: 'Enregistrer le scénario', exact: true }).click();
  await expect(page.locator('.saved-budget')).toHaveCount(2);
  await page
    .locator('.saved-budget')
    .last()
    .getByRole('button', { name: 'Choisir comme préféré' })
    .click();
  await expect(
    page.locator('.saved-budget').last().getByRole('heading', { level: 3 }),
  ).toContainText('Préféré');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/travaux-mobile.png', fullPage: true });
});
