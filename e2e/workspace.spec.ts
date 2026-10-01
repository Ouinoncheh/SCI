import { test, expect, type APIRequestContext } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { properties } from '../src/data/demo';
import sharp from 'sharp';

test('comptes vérifiés, isolation SCI, rôles, persistance et récupération', async ({
  playwright,
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const origin = 'http://127.0.0.1:3000';
  const password = 'Test-predict-SCI-2026!';
  const suffix = randomUUID();
  const clients: APIRequestContext[] = [];
  async function client() {
    const c = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { origin },
    });
    clients.push(c);
    return c;
  }
  async function mail(email: string, subject: string) {
    const dir = path.join(process.cwd(), '.local', 'mail');
    for (let attempt = 0; attempt < 30; attempt++) {
      for (const file of (await readdir(dir).catch(() => [])).sort().reverse()) {
        const content = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as {
          to: string;
          subject: string;
          url: string;
        };
        if (content.to === email && content.subject.includes(subject)) return content.url;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Message local de test introuvable');
  }
  async function signup(c: APIRequestContext, label: string) {
    const email = `${label}-${suffix}@example.invalid`;
    const result = await c.post('/api/auth/sign-up/email', {
      data: { email, password, name: `Test ${label}`, callbackURL: '/connexion' },
    });
    expect(result.status(), 'inscription').toBe(200);
    expect((await c.post('/api/auth/sign-in/email', { data: { email, password } })).status()).toBe(
      403,
    );
    const verify = await c.get(await mail(email, 'Vérifier'));
    expect(verify.ok()).toBe(true);
    expect((await c.post('/api/auth/sign-in/email', { data: { email, password } })).status()).toBe(
      200,
    );
    return email;
  }
  async function makeSci(c: APIRequestContext, name: string) {
    const r = await c.post('/api/workspace/scis', {
      data: { name, capital: 1000, taxRegime: 'SCI_IR', shares: 100 },
    });
    expect(r.status()).toBe(201);
    return (await r.json()).id as string;
  }
  try {
    const owner = await client(),
      stranger = await client(),
      viewer = await client(),
      anonymous = await client();
    expect((await anonymous.get('/api/workspace/scis')).status()).toBe(401);
    const email = await signup(owner, 'proprietaire'),
      viewerEmail = await signup(viewer, 'lecteur');
    await signup(stranger, 'autre');
    const sciId = await makeSci(owner, `SCI principale ${suffix}`),
      otherId = await makeSci(stranger, `SCI séparée ${suffix}`);
    const propertiesUrl = `/api/workspace/scis/${sciId}/properties`;
    const importUrl = `/api/workspace/scis/${sciId}/listing-import`;
    const listingSource = 'https://agence.example.org/annonce/1';
    const listingHtml =
      '<script type="application/ld+json">' +
      JSON.stringify({
        '@type': 'Apartment',
        name: 'Appartement importé',
        offers: { price: 190000, priceCurrency: 'EUR' },
        floorSize: { value: 63, unitCode: 'MTK' },
        image: ['https://images.example.org/photo.jpg'],
      }) +
      '</script>';
    expect(
      (
        await stranger.post(importUrl, { data: { url: listingSource, html: listingHtml } })
      ).status(),
    ).toBe(404);
    expect(
      (
        await owner.post(importUrl, {
          data: { url: 'https://unconfigured.example.org/annonce/123' },
        })
      ).status(),
    ).toBe(200);
    const wrongMethod = await owner.get(importUrl);
    expect(wrongMethod.status()).toBe(405);
    expect(wrongMethod.headers().allow).toBe('POST');
    const parsed = await owner.post(importUrl, { data: { url: listingSource, html: listingHtml } });
    expect(parsed.status()).toBe(200);
    const importedDraft = await parsed.json();
    expect(importedDraft).toMatchObject({
      status: 'READY',
      normalized: { price: 190000, surface: 63, images: ['https://images.example.org/photo.jpg'] },
    });
    const draftUrl = `/api/workspace/scis/${sciId}/imports/${importedDraft.id}`;
    expect((await stranger.get(draftUrl)).status()).toBe(404);
    const documentResponse = await owner.post(`${draftUrl}/files`, {
      multipart: {
        kind: 'document',
        file: {
          name: 'annonce.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Appartement importé\n2 chambres\nDPE : C'),
        },
      },
    });
    expect(documentResponse.status()).toBe(201);
    const documented = await documentResponse.json();
    expect(documented.draft.normalized).toMatchObject({
      price: 190000,
      surface: 63,
      bedrooms: 2,
      dpe: 'C',
    });
    expect(documented.draft.normalized.confidence.bedrooms.source).toBe('USER_PROVIDED_DOCUMENT');
    const image = await sharp({
      create: { width: 80, height: 60, channels: 3, background: '#b3aa99' },
    })
      .png()
      .toBuffer();
    const upload = await owner.post(`${draftUrl}/files`, {
      multipart: {
        kind: 'photo',
        file: { name: 'salon.png', mimeType: 'image/png', buffer: image },
      },
    });
    expect(upload.status()).toBe(201);
    const assetId = (await upload.json()).assetId;
    for (const size of ['thumbnail', 'medium', 'original']) {
      const photo = await owner.get(`${draftUrl}/files/${assetId}?size=${size}`);
      expect(photo.status()).toBe(200);
      expect(photo.headers()['content-type']).toBe('image/webp');
    }
    expect((await stranger.get(`${draftUrl}/files/${assetId}`)).status()).toBe(404);
    expect((await stranger.get(propertiesUrl)).status()).toBe(404);
    expect((await owner.get(`/api/workspace/scis/${otherId}/properties`)).status()).toBe(404);
    expect(
      (
        await owner.post('/api/workspace/scis', {
          headers: { origin: 'https://evil.invalid' },
          data: { name: 'Intrusion', capital: 0, taxRegime: 'SCI_IR', shares: 1 },
        })
      ).status(),
    ).toBe(403);
    const payload = {
      title: 'Bien de test persistant',
      city: 'Nantes',
      postcode: '44000',
      investment: properties[0].investment,
      listing: {
        sourceUrl: listingSource,
        method: 'html',
        photos: ['https://images.example.org/photo.jpg'],
        photoRights: true,
      },
    };
    expect(
      (
        await owner.post(propertiesUrl, {
          data: { ...payload, investment: { ...payload.investment, price: -1 } },
        })
      ).status(),
    ).toBe(400);
    const created = await owner.post(propertiesUrl, { data: payload });
    expect(created.status()).toBe(201);
    const id = (await created.json()).id;
    expect(
      (
        await stranger.patch(`/api/workspace/scis/${otherId}/properties/${id}`, {
          data: { version: 1, status: 'REJECTED' },
        })
      ).status(),
    ).toBe(404);
    const inv = await owner.post(`/api/workspace/scis/${sciId}/invitations`, {
      data: { email: viewerEmail, role: 'VIEWER', shares: 10 },
    });
    expect(inv.status()).toBe(201);
    const token = new URL((await inv.json()).url).hash.slice(1);
    expect(
      (await stranger.post('/api/workspace/invitations/accept', { data: { token } })).status(),
    ).toBe(404);
    expect(
      (await viewer.post('/api/workspace/invitations/accept', { data: { token } })).status(),
    ).toBe(200);
    expect(
      (await viewer.post('/api/workspace/invitations/accept', { data: { token } })).status(),
    ).toBe(404);
    expect((await viewer.get(propertiesUrl)).status()).toBe(200);
    expect((await (await viewer.get(propertiesUrl)).json())[0].listing).toEqual(payload.listing);
    expect(
      (await viewer.post(importUrl, { data: { url: listingSource, html: listingHtml } })).status(),
    ).toBe(403);
    expect((await viewer.post(propertiesUrl, { data: payload })).status()).toBe(403);
    expect(
      (
        await viewer.patch(`${propertiesUrl}/${id}`, { data: { version: 1, status: 'OFFER' } })
      ).status(),
    ).toBe(403);
    expect(
      (
        await viewer.post(`/api/workspace/scis/${sciId}/invitations`, {
          data: { email: 'unauthorized@example.invalid', role: 'ADMIN', shares: 0 },
        })
      ).status(),
    ).toBe(403);
    expect(
      (await viewer.put(`${propertiesUrl}/${id}/favorite`, { data: { favorite: true } })).status(),
    ).toBe(200);
    expect((await (await viewer.get(propertiesUrl)).json())[0].favorite).toBe(true);
    expect((await (await owner.get(propertiesUrl)).json())[0].favorite).toBe(false);
    const changed = { ...payload.investment, monthlyRent: 1600 };
    const updates = await Promise.all([
      owner.patch(`${propertiesUrl}/${id}`, { data: { version: 1, investment: changed } }),
      owner.patch(`${propertiesUrl}/${id}`, { data: { version: 1, investment: changed } }),
    ]);
    expect(updates.map((r) => r.status()).sort()).toEqual([200, 409]);
    await owner.post('/api/workspace/active-sci', { data: { sciId } });
    await page.context().addCookies((await owner.storageState()).cookies);
    await page.goto(`/espace/biens/${id}`);
    await expect(page.getByRole('heading', { name: payload.title })).toBeVisible();
    await page.getByRole('tab', { name: 'Hypothèses', exact: true }).click();
    await expect(page.getByLabel('Loyer mensuel hors charges')).toHaveValue('1600');
    await page.getByLabel('Loyer mensuel hors charges').fill('1700');
    await page.getByRole('button', { name: 'Enregistrer et recalculer' }).click();
    await expect(
      page.getByText('Analyse enregistrée. Le comparateur utilise maintenant ces hypothèses.'),
    ).toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: 'Hypothèses', exact: true }).click();
    await expect(page.getByLabel('Loyer mensuel hors charges')).toHaveValue('1700');
    const collaborationUrl = `${propertiesUrl}/${id}/collaboration`;
    const historyUrl = `${propertiesUrl}/${id}/history`;
    const stateBefore = await (await owner.get(propertiesUrl)).json();
    const foreignDetails = await (await stranger.get(`/api/workspace/scis/${otherId}`)).json();
    const foreignMember = foreignDetails.members[0].id;
    expect((await stranger.get(collaborationUrl)).status()).toBe(404);
    expect((await stranger.get(historyUrl)).status()).toBe(404);
    expect(
      (
        await owner.get(`/api/workspace/scis/${sciId}/properties/inexistant/collaboration`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await viewer.post(`${propertiesUrl}/${id}/comments`, { data: { body: 'Interdit' } })
      ).status(),
    ).toBe(403);
    expect(
      (await viewer.put(`${propertiesUrl}/${id}/vote`, { data: { choice: 'FAVORABLE' } })).status(),
    ).toBe(403);
    expect(
      (
        await owner.post(`${propertiesUrl}/${id}/comments`, {
          data: { body: 'Mention étrangère', mentionedMemberIds: [foreignMember] },
        })
      ).status(),
    ).toBe(400);
    expect(
      (await owner.post(`${propertiesUrl}/${id}/comments`, { data: { body: '  ' } })).status(),
    ).toBe(400);
    await page.getByRole('tab', { name: 'Échanges', exact: true }).click();
    await page
      .getByLabel('Votre commentaire')
      .fill('Prévoir une visite. <img src=x onerror=alert(1)>');
    await page.getByRole('checkbox', { name: 'Test lecteur' }).check();
    await page.getByRole('button', { name: 'Publier le commentaire' }).click();
    await expect(page.locator('.comment')).toHaveCount(1);
    await expect(page.locator('.comment img')).toHaveCount(0);
    await page.getByRole('button', { name: 'Favorable · 0', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Favorable · 1', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      (await owner.put(`${propertiesUrl}/${id}/vote`, { data: { choice: 'TO_STUDY' } })).status(),
    ).toBe(200);
    let exchanges = await (await owner.get(collaborationUrl)).json();
    expect(exchanges.votes).toHaveLength(1);
    expect(exchanges.votes[0].choice).toBe('TO_STUDY');
    expect(
      (await owner.put(`${propertiesUrl}/${id}/vote`, { data: { choice: null } })).status(),
    ).toBe(200);
    exchanges = await (await owner.get(collaborationUrl)).json();
    expect(exchanges.votes).toHaveLength(0);
    expect(await (await owner.get(propertiesUrl)).json()).toEqual(stateBefore);
    const notificationsUrl = `/api/workspace/scis/${sciId}/notifications`;
    const notifications = await (await viewer.get(notificationsUrl)).json();
    expect(notifications.unread).toBe(1);
    const viewerContext = await browser.newContext({
      storageState: await viewer.storageState(),
      viewport: { width: 390, height: 844 },
    });
    try {
      const viewerPage = await viewerContext.newPage();
      await viewerPage.goto(`${origin}/espace/notifications`);
      await expect(
        viewerPage.getByRole('heading', { name: '1 non lue', exact: true }),
      ).toBeVisible();
      await viewerPage.screenshot({
        path: 'test-results/notifications-mobile.png',
        fullPage: true,
      });
      await viewerPage.getByRole('button', { name: 'Marquer comme lue' }).click();
      await expect(
        viewerPage.getByRole('heading', { name: '0 non lue', exact: true }),
      ).toBeVisible();
      await viewerPage.goto(`${origin}/espace/biens/${id}`);
      await viewerPage.getByRole('tab', { name: 'Échanges', exact: true }).click();
      await expect(
        viewerPage.getByRole('button', { name: 'Favorable · 0', exact: true }),
      ).toBeDisabled();
      await expect(viewerPage.getByLabel('Votre commentaire')).toHaveCount(0);
      expect(
        await viewerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    } finally {
      await viewerContext.close();
    }
    expect((await (await owner.get(notificationsUrl)).json()).entries).toHaveLength(0);
    expect(
      (
        await owner.patch(`${notificationsUrl}/${notifications.entries[0].id}`, {
          data: { read: true },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await viewer.patch(`${notificationsUrl}/${notifications.entries[0].id}`, {
          data: { read: true },
        })
      ).status(),
    ).toBe(200);
    expect((await (await viewer.get(notificationsUrl)).json()).unread).toBe(0);
    const history = await (await owner.get(historyUrl)).json();
    expect(history.entries).toHaveLength(3);
    expect(
      history.entries.map((e: { inputs: { monthlyRent: number } }) => e.inputs.monthlyRent),
    ).toEqual([1700, 1600, payload.investment.monthlyRent]);
    await page.getByRole('tab', { name: 'Historique', exact: true }).click();
    await expect(page.locator('.analysis-snapshot')).toHaveCount(3);
    await page.locator('.analysis-snapshot summary').first().click();
    await expect(
      page
        .locator('.analysis-snapshot')
        .first()
        .getByText('Loyer mensuel hors charges', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: 'Échanges', exact: true }).click();
    await expect(page.locator('.comment')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/echanges-desktop.png', fullPage: true });
    const beforeEdit = (await (await owner.get(propertiesUrl)).json())[0];
    const details = {
      title: 'Appartement corrigé',
      city: 'Rezé',
      postcode: '44400',
      address: '12 rue de test',
      rooms: 3,
      dpe: 'C',
      description: 'Description corrigée',
    };
    expect(
      (
        await viewer.patch(`${propertiesUrl}/${id}`, {
          data: { version: beforeEdit.version, details },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await stranger.patch(`${propertiesUrl}/${id}`, {
          data: { version: beforeEdit.version, details },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await owner.patch(`${propertiesUrl}/${id}`, {
          data: { version: beforeEdit.version, details: { ...details, postcode: 'abc' } },
        })
      ).status(),
    ).toBe(400);
    await page.getByRole('tab', { name: 'Caractéristiques', exact: true }).click();
    await page.getByLabel('Titre du bien').fill(details.title);
    await page.getByLabel('Ville', { exact: true }).fill(details.city);
    await page.getByLabel('Code postal').fill(details.postcode);
    await page.getByLabel('Adresse (facultatif)').fill(details.address);
    await page.getByLabel('Nombre de pièces (0 = inconnu)').fill('3');
    await page.getByLabel('DPE déclaré', { exact: true }).selectOption('C');
    await page.getByLabel('Description', { exact: true }).fill(details.description);
    await page.getByRole('button', { name: 'Enregistrer les caractéristiques' }).click();
    await expect(page.getByRole('status')).toHaveText('Caractéristiques enregistrées.');
    expect(
      (
        await owner.patch(`${propertiesUrl}/${id}`, {
          data: { version: beforeEdit.version, details },
        })
      ).status(),
    ).toBe(409);
    await page.reload();
    await expect(page.getByRole('heading', { name: details.title, exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Caractéristiques', exact: true }).click();
    await expect(page.getByLabel('Adresse (facultatif)')).toHaveValue(details.address);
    await expect(page.getByLabel('DPE déclaré', { exact: true })).toHaveValue('C');
    const afterEdit = (await (await owner.get(propertiesUrl)).json())[0];
    expect(afterEdit.investment).toEqual(beforeEdit.investment);
    expect((await (await owner.get(historyUrl)).json()).entries).toEqual(history.entries);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/caracteristiques-mobile.png', fullPage: true });
    const roomsUrl = `${propertiesUrl}/${id}/rooms`;
    const roomInput = {
      name: 'Salon test',
      roomType: 'Salon',
      floor: 0,
      areaEstimate: null,
      notes: 'Photo de test synthétique',
    };
    expect((await viewer.post(roomsUrl, { data: roomInput })).status()).toBe(403);
    expect((await stranger.get(roomsUrl)).status()).toBe(404);
    await page.getByRole('tab', { name: 'Visualisation', exact: true }).click();
    await page.getByText('Ajouter une pièce', { exact: true }).click();
    await page.getByLabel('Nom de la pièce').fill(roomInput.name);
    await page.getByRole('button', { name: 'Créer la pièce', exact: true }).click();
    await expect(page.getByRole('heading', { name: roomInput.name })).toBeVisible();
    const png = await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#d0d8c5' },
    })
      .png()
      .toBuffer();
    await page
      .getByLabel('Ajouter des photos', { exact: true })
      .setInputFiles({ name: 'salon.png', mimeType: 'image/png', buffer: png });
    await page.getByLabel('Angle de vue').fill('Depuis la porte');
    await page.getByRole('button', { name: 'Enregistrer les photos' }).click();
    await expect(page.locator('.room-photos img')).toHaveCount(1);
    const gallery = await (await owner.get(roomsUrl)).json();
    expect(gallery[0].photos[0]).toMatchObject({
      angleLabel: 'Depuis la porte',
      width: 640,
      height: 480,
      isCover: true,
    });
    const privatePhoto = `${propertiesUrl}/${id}/photos/${gallery[0].photos[0].id}`;
    expect((await anonymous.get(privatePhoto)).status()).toBe(401);
    expect((await stranger.get(privatePhoto)).status()).toBe(404);
    const imageResponse = await viewer.get(`${privatePhoto}?thumbnail=1`);
    expect(imageResponse.status()).toBe(200);
    expect(imageResponse.headers()['cache-control']).toBe('private, no-store');
    expect((await sharp(await imageResponse.body()).metadata()).width).toBe(480);
    const photoUpload = `${roomsUrl}/${gallery[0].id}/photos`;
    expect(
      (
        await viewer.post(photoUpload, {
          multipart: { photo: { name: 'x.png', mimeType: 'image/png', buffer: png } },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await owner.post(photoUpload, {
          multipart: {
            photo: {
              name: 'x.png',
              mimeType: 'image/png',
              buffer: Buffer.from('<script>bad</script>'),
            },
          },
        })
      ).status(),
    ).toBe(400);
    await page.reload();
    await page.getByRole('tab', { name: 'Visualisation', exact: true }).click();
    await expect(page.locator('.room-photos img')).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/room-gallery-mobile.png', fullPage: true });
    const renovationUrl = `${propertiesUrl}/${id}/renovation`;
    const scenarioInput = {
      name: 'Travaux standard',
      description: 'Budget de test',
      monthlyRent: 1800,
      contingencyRate: 10,
      budgetMode: 'CENTRAL',
      items: [
        {
          id: 'paint-test',
          roomId: gallery[0].id,
          category: 'PAINT',
          label: 'Peinture du salon',
          quantity: 20,
          unit: 'm²',
          unitMin: 15,
          unitMax: 25,
          source: 'QUOTE',
          notes: 'Devis TEST-01',
          contractor: 'Artisan test',
          quoteReference: 'TEST-01',
          quoteStatus: 'ACCEPTED',
          expenses: [
            {
              id: 'payment-test',
              label: 'Acompte',
              amount: 120,
              date: '2026-10-01',
              reference: 'FACT-01',
            },
          ],
          actualFinal: false,
        },
      ],
    };
    expect((await stranger.get(renovationUrl)).status()).toBe(404);
    expect((await viewer.post(renovationUrl, { data: scenarioInput })).status()).toBe(403);
    expect(
      (
        await owner.post(renovationUrl, {
          data: {
            ...scenarioInput,
            items: [{ ...scenarioInput.items[0], roomId: 'foreign-room' }],
          },
        })
      ).status(),
    ).toBe(400);
    const scenarioCreate = await owner.post(renovationUrl, { data: scenarioInput });
    expect(scenarioCreate.status()).toBe(201);
    const scenarioId = (await scenarioCreate.json()).id;
    expect((await (await viewer.get(renovationUrl)).json())[0]).toMatchObject({
      ...scenarioInput,
      id: scenarioId,
      version: 1,
    });
    expect(
      (
        await viewer.patch(`${renovationUrl}/${scenarioId}`, {
          data: { version: 1, favorite: true },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await owner.patch(`${renovationUrl}/${scenarioId}`, {
          data: { version: 1, favorite: true },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await owner.patch(`${renovationUrl}/${scenarioId}`, {
          data: { version: 1, data: scenarioInput },
        })
      ).status(),
    ).toBe(409);
    await page.getByRole('tab', { name: 'Travaux & scénarios', exact: true }).click();
    await expect(page.locator('.saved-budget')).toHaveCount(1);
    await expect(page.locator('.saved-budget').getByRole('heading', { level: 3 })).toContainText(
      'Préféré',
    );
    await expect(page.locator('.saved-budget .spending-summary')).toContainText('120');
    await page
      .locator('.saved-budget')
      .getByRole('button', { name: 'Appliquer à l’analyse principale' })
      .click();
    await expect(page.getByRole('status')).toContainText('appliquées');
    const applied = (await (await owner.get(propertiesUrl)).json())[0];
    expect(applied.investment).toMatchObject({
      works: 400,
      contingencyRate: 10,
      furniture: 0,
      monthlyRent: 1800,
    });
    expect((await (await owner.get(historyUrl)).json()).entries).toHaveLength(4);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/travaux-prives-mobile.png', fullPage: true });
    const designsUrl = `${propertiesUrl}/${id}/designs`;
    const designInput = {
      name: 'Salon après travaux',
      photoId: gallery[0].photos[0].id,
      scenarioId,
      style: 'Moderne',
      renovationLevel: 'Rafraîchissement',
      prompt: 'Murs blancs cassés et parquet clair, conserver les fenêtres.',
    };
    expect((await stranger.get(designsUrl)).status()).toBe(404);
    expect((await viewer.post(designsUrl, { data: designInput })).status()).toBe(403);
    expect(
      (
        await owner.post(designsUrl, { data: { ...designInput, photoId: 'foreign-photo' } })
      ).status(),
    ).toBe(404);
    await page.getByRole('tab', { name: 'Visualisation', exact: true }).click();
    await page.getByLabel('Photo source').selectOption(designInput.photoId);
    await page.getByLabel('Nom du projet').fill(designInput.name);
    await page.getByLabel('Scénario travaux associé').selectOption(scenarioId);
    await page.getByLabel('Votre projet de rénovation').fill(designInput.prompt);
    await page.getByRole('button', { name: 'Enregistrer le projet visuel' }).click();
    await expect(page.locator('.design-project')).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Générer la projection', exact: true }),
    ).toBeDisabled();
    const designData = await (await viewer.get(designsUrl)).json();
    expect(designData.configuration.ready).toBe(false);
    expect(designData.projects[0]).toMatchObject({ ...designInput, roomId: gallery[0].id });
    const projectId = designData.projects[0].id;
    expect(
      (
        await owner.post(`${designsUrl}/${projectId}/generate`, {
          data: { requestKey: randomUUID(), variants: 1, consent: true },
        })
      ).status(),
    ).toBe(503);
    expect(
      (
        await owner.post(`${designsUrl}/${projectId}/generate`, {
          data: { requestKey: randomUUID(), variants: 1, consent: false },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await viewer.post(`${designsUrl}/${projectId}/generate`, {
          data: { requestKey: randomUUID(), variants: 1, consent: true },
        })
      ).status(),
    ).toBe(403);
    const fakeVisual = {
      id: 'fixture-visual',
      status: 'SUCCEEDED',
      variationLabel: 'Variante A (fixture)',
      modelName: 'mock-test',
      provider: 'mock',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      errorMessage: null,
      favorite: false,
    };
    await page.route(`${origin}${designsUrl}`, async (route) => {
      if (route.request().method() === 'GET')
        await route.fulfill({
          json: { ...designData, projects: [{ ...designData.projects[0], visuals: [fakeVisual] }] },
        });
      else await route.continue();
    });
    const fakeImage = await sharp(png).tint('#e8dcc8').webp().toBuffer();
    await page.route(`${origin}${designsUrl}/visuals/fixture-visual`, async (route) =>
      route.fulfill({ contentType: 'image/webp', body: fakeImage }),
    );
    await page.reload();
    await page.getByRole('tab', { name: 'Visualisation', exact: true }).click();
    await expect(page.locator('.before-after img')).toHaveCount(2);
    await page.getByLabel('Comparer avant / après').fill('70');
    await expect(page.locator('.after-image')).toHaveCSS('clip-path', 'inset(0px 30% 0px 0px)');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/projection-mobile-fixture.png', fullPage: true });
    await page.unroute(`${origin}${designsUrl}`);
    await page.unroute(`${origin}${designsUrl}/visuals/fixture-visual`);
    expect(
      (await viewer.patch(`${designsUrl}/${projectId}`, { data: { archived: true } })).status(),
    ).toBe(403);
    expect(
      (await owner.patch(`${designsUrl}/${projectId}`, { data: { archived: true } })).status(),
    ).toBe(200);
    expect((await (await owner.get(designsUrl)).json()).projects).toHaveLength(0);
    const originalPhoto = gallery[0].photos[0];
    const editPhoto = {
      angleLabel: 'Vue corrigée',
      comment: 'Mur à rénover',
      roomId: gallery[0].id,
      makeCover: true,
      expected: {
        roomId: gallery[0].id,
        angleLabel: originalPhoto.angleLabel,
        comment: originalPhoto.comment,
        isCover: originalPhoto.isCover,
      },
    };
    expect((await viewer.patch(privatePhoto, { data: editPhoto })).status()).toBe(403);
    expect((await stranger.patch(privatePhoto, { data: editPhoto })).status()).toBe(404);
    expect((await owner.patch(privatePhoto, { data: editPhoto })).status()).toBe(200);
    expect((await owner.patch(privatePhoto, { data: editPhoto })).status()).toBe(409);
    const newRoomResponse = await owner.post(roomsUrl, {
      data: { ...roomInput, name: 'Chambre déplacement' },
    });
    const newRoomId = (await newRoomResponse.json()).id;
    const updatedExpected = {
      roomId: gallery[0].id,
      angleLabel: editPhoto.angleLabel,
      comment: editPhoto.comment,
      isCover: true,
    };
    expect(
      (
        await owner.patch(privatePhoto, {
          data: { ...editPhoto, expected: updatedExpected, roomId: newRoomId },
        })
      ).status(),
    ).toBe(409);
    const secondUpload = await owner.post(`${roomsUrl}/${gallery[0].id}/photos`, {
      multipart: {
        photo: { name: 'second.png', mimeType: 'image/png', buffer: png },
        angleLabel: '',
        comment: '',
      },
    });
    expect(secondUpload.status()).toBe(201);
    const latestRooms = await (await owner.get(roomsUrl)).json();
    const second = latestRooms[0].photos.find(
      (photo: { id: string }) => photo.id !== originalPhoto.id,
    );
    const secondUrl = `${propertiesUrl}/${id}/photos/${second.id}`;
    const secondEdit = {
      angleLabel: '',
      comment: '',
      roomId: gallery[0].id,
      makeCover: true,
      expected: { roomId: gallery[0].id, angleLabel: '', comment: '', isCover: false },
    };
    expect((await owner.patch(secondUrl, { data: secondEdit })).status()).toBe(200);
    expect(
      (await (await owner.get(roomsUrl)).json())[0].photos.filter(
        (photo: { isCover: boolean }) => photo.isCover,
      ),
    ).toHaveLength(1);
    expect(
      (
        await owner.patch(secondUrl, {
          data: {
            ...secondEdit,
            roomId: 'foreign-room',
            expected: { ...secondEdit.expected, isCover: true },
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await owner.patch(secondUrl, {
          data: {
            ...secondEdit,
            roomId: newRoomId,
            expected: { ...secondEdit.expected, isCover: true },
          },
        })
      ).status(),
    ).toBe(200);
    const movedRooms = await (await owner.get(roomsUrl)).json();
    expect(movedRooms[0].photos[0]).toMatchObject({
      id: originalPhoto.id,
      isCover: true,
      angleLabel: 'Vue corrigée',
    });
    expect(
      movedRooms.find((room: { id: string }) => room.id === newRoomId).photos[0],
    ).toMatchObject({ id: second.id, isCover: true });
    await page.reload();
    await page.getByRole('tab', { name: 'Visualisation', exact: true }).click();
    await page.locator('.room-photos summary').first().click();
    await page.getByLabel('Angle de la photo', { exact: true }).fill('Vue depuis le balcon');
    await page.getByRole('button', { name: 'Enregistrer les modifications', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Photo mise à jour.' })).toBeVisible();
    await expect(page.locator('.room-photos strong').first()).toHaveText('Vue depuis le balcon');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: 'test-results/photo-editor-mobile.png', fullPage: true });
    expect(
      (
        await owner.patch(`${renovationUrl}/${scenarioId}`, {
          data: { version: 2, archived: true },
        })
      ).status(),
    ).toBe(200);
    expect(await (await viewer.get(renovationUrl)).json()).toHaveLength(0);
    await page.goto('/espace/biens/nouveau');
    await page.getByLabel('URL de l’annonce').fill(listingSource);
    await page.getByLabel('Fichier HTML de l’annonce', { exact: false }).setInputFiles({
      name: 'annonce.html',
      mimeType: 'text/html',
      buffer: Buffer.from(listingHtml),
    });
    await page.getByRole('button', { name: 'Analyser le bien', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Aperçu — à vérifier avant utilisation' }),
    ).toBeVisible();
    await expect(page.locator('.listing-photos img')).toHaveCount(1);
    await expect(
      page.getByLabel('Je dispose de l’autorisation de réutiliser ces photos dans mon bien.'),
    ).not.toBeChecked();
    await page.getByRole('button', { name: 'Utiliser ces informations sans photos' }).click();
    await expect(page.getByLabel('Nom du bien')).toHaveValue('Appartement importé');
    await expect(page.locator('form').getByLabel('Ville', { exact: true })).toHaveValue('');
    const overflow = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*'))
        .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
        .map((e) => ({
          tag: e.tagName,
          class: e.className,
          width: e.getBoundingClientRect().width,
        }))
        .slice(-15),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      JSON.stringify(overflow),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/import-mobile.png', fullPage: true });
    const assistedPayload = {
      ...payload,
      listing: {
        sourceUrl: listingSource,
        method: 'text',
        photos: [],
        photoRights: true,
        draftId: importedDraft.id,
      },
    };
    const assistedCreated = await owner.post(propertiesUrl, { data: assistedPayload });
    expect(assistedCreated.status()).toBe(201);
    const assistedId = (await assistedCreated.json()).id;
    expect((await owner.get(draftUrl)).status()).toBe(200);
    expect((await (await owner.get(draftUrl)).json()).status).toBe('CONVERTED');
    expect((await owner.post(propertiesUrl, { data: assistedPayload })).status()).toBe(409);
    const assistedProperty = (await (await owner.get(propertiesUrl)).json()).find(
      (p: { id: string }) => p.id === assistedId,
    );
    expect(assistedProperty.investment).toEqual(payload.investment);
    expect(assistedProperty.importData.normalized.confidence.bedrooms.source).toBe(
      'USER_PROVIDED_DOCUMENT',
    );
    expect(assistedProperty.listing.photos).toEqual([]);
    expect((await owner.get(assistedProperty.photoUrl)).status()).toBe(200);
    expect(
      (
        await owner.post('/api/auth/request-password-reset', {
          data: { email, redirectTo: `${origin}/reinitialiser` },
        })
      ).status(),
    ).toBe(200);
    const resetRedirect = await owner.get(await mail(email, 'Réinitialiser'), { maxRedirects: 0 });
    const resetToken = new URL(resetRedirect.headers().location, origin).searchParams.get('token');
    expect(Boolean(resetToken)).toBe(true);
    const newPassword = 'Second-predict-SCI-2026!';
    expect(
      (
        await owner.post('/api/auth/reset-password', { data: { token: resetToken, newPassword } })
      ).status(),
    ).toBe(200);
    expect((await owner.get('/api/workspace/scis')).status()).toBe(401);
    expect(
      (
        await owner.post('/api/auth/reset-password', { data: { token: resetToken, newPassword } })
      ).status(),
    ).not.toBe(200);
    expect(
      (await owner.post('/api/auth/sign-in/email', { data: { email, password } })).status(),
    ).not.toBe(200);
    expect(
      (
        await owner.post('/api/auth/sign-in/email', { data: { email, password: newPassword } })
      ).status(),
    ).toBe(200);
    expect((await owner.post('/api/auth/sign-out', { data: {} })).status()).toBe(200);
    expect((await owner.get('/api/workspace/scis')).status()).toBe(401);
  } finally {
    await Promise.all(clients.map((c) => c.dispose()));
  }
});
