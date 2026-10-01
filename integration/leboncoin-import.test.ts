import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import fixture from '../tests/fixtures/leboncoin-ad.json';
import { properties } from '../src/data/demo';
import { db } from '../src/server/db';
import { POST } from '../src/app/api/listings/import/route';

const auth = vi.hoisted(() => ({ id: '' }));
vi.mock('../src/server/auth', () => ({
  getAuth: () => ({
    api: { getSession: async () => ({ user: { id: auth.id, emailVerified: true } }) },
  }),
}));

// Explicit local-only integration suite; no remote database or portal is contacted.
process.loadEnvFile('.env');
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname))
  throw new Error('Les tests d’intégration exigent PostgreSQL local.');
let server: Server;
let sciId: string;
let userId: string;
let strangerId: string;
let status = 200;
let ad = fixture;
let calls = 0;
const url = 'https://www.leboncoin.fr/ad/ventes_immobilieres/1234567890';
const request = (body: unknown) =>
  POST(
    new Request('http://127.0.0.1:3000/api/listings/import', {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
beforeAll(async () => {
  vi.stubEnv('BETTER_AUTH_URL', 'http://127.0.0.1:3000');
  vi.stubEnv('LEBONCOIN_SERVICE_TOKEN', 'test-only-internal-token');
  server = createServer((req, res) => {
    calls++;
    expect(req.url).toBe('/ads/1234567890');
    expect(req.headers.authorization).toBe('Bearer test-only-internal-token');
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status === 200 ? ad : { code: 'MANUAL_IMPORT_REQUIRED' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Port local manquant');
  vi.stubEnv('LEBONCOIN_SERVICE_URL', `http://127.0.0.1:${address.port}`);
  userId = (
    await db.user.create({
      data: {
        email: `${randomUUID()}@example.invalid`,
        name: 'Import integration',
        emailVerified: true,
      },
    })
  ).id;
  strangerId = (
    await db.user.create({
      data: {
        email: `${randomUUID()}@example.invalid`,
        name: 'Import stranger',
        emailVerified: true,
      },
    })
  ).id;
  sciId = (
    await db.sCI.create({
      data: {
        name: 'Import integration',
        capital: 0,
        taxRegime: 'SCI_IR',
        financialSettings: {},
        investmentAssumptions: {},
        members: { create: { userId, role: 'ADMIN', shares: 100 } },
      },
    })
  ).id;
});
beforeEach(() => {
  auth.id = userId;
  status = 200;
  ad = fixture;
  calls = 0;
});
afterAll(async () => {
  if (sciId) await db.sCI.delete({ where: { id: sciId } });
  for (const id of [userId, strangerId].filter(Boolean)) {
    await db.apiRateBucket.deleteMany({
      where: { key: createHash('sha256').update(`listing-import:${id}`).digest('hex') },
    });
    await db.user.delete({ where: { id } });
  }
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.$disconnect();
  vi.unstubAllEnvs();
});
describe('URL → HTTP simulé → normalisation → PostgreSQL → analyse', () => {
  it('persiste le brouillon, crée le bien et calcule avec les hypothèses explicites', async () => {
    const sample = properties[0];
    const response = await request({
      sciId,
      url,
      photoRights: true,
      property: {
        title: 'Hypothèse',
        city: 'Rognac',
        postcode: '13340',
        investment: sample.investment,
      },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      status: 'IMPORTED',
      property: { id: expect.any(String) },
      draft: { status: 'CONVERTED' },
    });
    const property = await db.property.findUniqueOrThrow({
      where: { id: data.property.id },
      include: { analyses: true, listings: true },
    });
    expect(Number(property.price)).toBe(245000);
    expect(Number(property.area)).toBe(70);
    expect(property.analyses).toHaveLength(1);
    expect(data.analysis.financial).toBeTruthy();
    expect(data.analysis.financial.afterTaxYield).toBeNull();
    expect(property.listings[0].normalizedData).toMatchObject({
      photos: fixture.images,
      provenance: { rawAttributes: { custom_feature: 'À confirmer' } },
    });
    expect(calls).toBe(1);
  });
  it('conserve les champs dans un brouillon sans inventer d’hypothèses financières', async () => {
    const response = await request({ sciId, url });
    const data = await response.json();
    expect(data.property).toBeNull();
    expect(data.analysis).toBeNull();
    const draft = await db.propertyImportDraft.findUniqueOrThrow({ where: { id: data.draft.id } });
    expect(draft.normalized).toMatchObject({
      price: 245000,
      surface: 70,
      sourceListingId: '1234567890',
    });
  });
  it('persiste le fallback sans perdre l’URL après un refus puis accepte une correction', async () => {
    status = 403;
    const response = await request({ sciId, url });
    const data = await response.json();
    expect(data.draft).toMatchObject({
      status: 'NEEDS_MANUAL_IMPORT',
      errorCode: 'MANUAL_IMPORT_REQUIRED',
      sourceUrl: url,
    });
    const draft = await db.propertyImportDraft.findUniqueOrThrow({ where: { id: data.draft.id } });
    expect(draft.status).toBe('NEEDS_MANUAL_IMPORT');
    expect(calls).toBe(1);
    const corrected = await request({
      sciId,
      url,
      draftId: draft.id,
      version: draft.version,
      text: 'Appartement\nPrix : 170000 €\nSurface : 60 m²\n13340 Rognac',
    });
    expect(corrected.status).toBe(200);
    expect((await corrected.json()).draft.normalized.price).toBe(170000);
    expect(calls).toBe(1);
  });
  it('bloque l’accès à une autre SCI avant tout appel du service', async () => {
    auth.id = strangerId;
    expect((await request({ sciId, url })).status).toBe(404);
    expect(calls).toBe(0);
  });
  it('rejette URL invalide et requête ambiguë sans contacter le service', async () => {
    expect((await request({ sciId, url: 'http://localhost' })).status).toBe(400);
    expect((await request({ sciId, url, text: 'prix', html: 'prix' })).status).toBe(400);
    expect(calls).toBe(0);
  });
});
