import { describe, it, expect, vi, afterEach } from 'vitest';
import fixture from './fixtures/leboncoin-ad.json';
import { extractLeboncoinAdId } from '../src/listing-providers/provider';
import {
  LeboncoinProvider,
  normalizeLeboncoinAd,
  parseLeboncoinAttributes,
} from '../src/listing-providers/leboncoin';
import { ManualListingProvider } from '../src/listing-providers/manual';
import { ListingImporter, StructuredHtmlProvider } from '../src/listing-providers/importer';
import { getLeboncoinAd } from '../src/server/leboncoin-service';
const url = 'https://www.leboncoin.fr/ad/ventes_immobilieres/1234567890';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('provider Leboncoin isolé', () => {
  it('omet les attributs sensibles et les clés de prototype', () => {
    const result = parseLeboncoinAttributes(JSON.parse('{"cookie":"private","access_token":"private","__proto__":["invalid"],"custom":"known"}'));
    expect(result.rawAttributes).toEqual({ custom: 'known' });
  });
  it('traduit timeout, erreur réseau et réponse invalide en fallback exploitable', async () => {
    vi.stubEnv('LEBONCOIN_SERVICE_URL', 'http://127.0.0.1:8001');
    vi.stubEnv('LEBONCOIN_SERVICE_TOKEN', 'private-token');
    const fetch = vi.fn().mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response('bad json', { headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('x'.repeat(1_000_001), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    for (const code of ['LEBONCOIN_SERVICE_UNAVAILABLE', 'LEBONCOIN_SERVICE_UNAVAILABLE', 'LEBONCOIN_IMPORT_FAILED', 'LEBONCOIN_IMPORT_FAILED'])
      await expect(getLeboncoinAd('1234567890')).rejects.toMatchObject({ code });
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it.each([
    url,
    url + '?utm_source=share#details',
    'https://leboncoin.fr/ventes_immobilieres/1234567890.htm',
    'https://m.leboncoin.fr/ad/ventes_immobilieres/1234567890/',
  ])('extrait uniquement un ID de chemin d’annonce valide : %s', (value) => {
    expect(extractLeboncoinAdId(value)).toBe('1234567890');
  });
  it.each([
    'https://leboncoin.fr.evil.org/ad/ventes_immobilieres/1234567890',
    'https://evil.org/1234567890',
    'https://www.leboncoin.fr/recherche?ad_id=1234567890',
    'http://www.leboncoin.fr/ad/ventes_immobilieres/1234567890',
    'https://user:pass@www.leboncoin.fr/ad/ventes_immobilieres/1234567890',
    'not a URL',
  ])('refuse %s', (value) => expect(extractLeboncoinAdId(value)).toBeNull());
  it('détecte le provider et normalise les données sans supposer les attributs absents', async () => {
    const service = vi.fn().mockResolvedValue(fixture);
    const provider = new LeboncoinProvider(service);
    expect(provider.canHandle(url)).toBe(true);
    expect(provider.canHandle('https://seloger.com/ad/1234567890')).toBe(false);
    const result = await provider.fetchListing(url);
    expect(service).toHaveBeenCalledWith('1234567890');
    expect(result).toMatchObject({
      source: 'LEBONCOIN',
      sourceListingId: '1234567890',
      price: 245000,
      surface: 70,
      city: 'Rognac',
      postalCode: '13340',
      rooms: 3,
      bedrooms: 2,
      elevator: false,
      balcony: true,
      garden: null,
      propertyTax: null,
      condominiumFees: null,
      dpe: 'C',
      ges: 'D',
      pricePerSquareMeter: 3500,
    });
    expect(result.rawAttributes?.custom_feature).toBe('À confirmer');
  });
  it('accepte les attributs libellés mais laisse les unités de charges ambiguës inconnues', () => {
    const result = parseLeboncoinAttributes({
      Surface: '70 m²',
      Ascenseur: 'Non',
      'Charges de copropriété': '100 €',
      'Charges annuelles': '1200 €',
    });
    expect(result.values).toMatchObject({ surface: 70, elevator: false, condominiumFees: 1200 });
    expect(result.rawAttributes['Charges de copropriété']).toBe('100 €');
  });
  it('tolère les champs malformés sans perdre les champs valides', () => {
    const result = normalizeLeboncoinAd(
      {
        id: '1234567890',
        title: 'Appartement',
        price: 'inconnu',
        location: { city: 'Rognac', zipcode: 13340, lat: 200 },
        attributes: { rooms: 'beaucoup', dpe: 'Z' },
        images: ['javascript:alert(1)', 'http://localhost/photo', ...fixture.images],
      },
      url,
    );
    expect(result).toMatchObject({
      city: 'Rognac',
      price: null,
      rooms: null,
      postalCode: null,
      latitude: null,
      dpe: null,
      images: fixture.images,
    });
    expect(() => normalizeLeboncoinAd({ ...fixture, id: '999' }, url)).toThrow();
    expect(() => normalizeLeboncoinAd({}, url)).toThrow();
  });
  it('ne fait jamais de fetch HTML sur un lien Leboncoin et conserve le fallback', async () => {
    const html = vi.fn();
    const service = vi.fn().mockRejectedValue(new Error('timeout secret details'));
    const result = await new ListingImporter(
      new StructuredHtmlProvider(html),
      new LeboncoinProvider(service),
    ).import(url);
    expect(html).not.toHaveBeenCalled();
    expect(service).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'NEEDS_MANUAL_IMPORT',
      normalized: { sourceUrl: url, price: null, importStatus: 'NEEDS_MANUAL_IMPORT' },
    });
    expect(result.message).toContain('manuellement');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(
      (
        await new ManualListingProvider('Prix : 170000 €\nTerrain de 253 m² à Rognac').fetchListing(
          url,
        )
      ).price,
    ).toBe(170000);
  });
  it('importe le résultat MCP et laisse les corrections manuelles prioritaires', async () => {
    const service = vi.fn().mockResolvedValue(fixture);
    const importer = new ListingImporter(
      new StructuredHtmlProvider(vi.fn()),
      new LeboncoinProvider(service),
    );
    expect((await importer.import(url)).normalized.importStatus).toBe('IMPORTED');
    await importer.import(url, { text: 'Prix : 170000 €' });
    expect(service).toHaveBeenCalledTimes(1);
  });
  it.each([404, 403, 503])('traduit HTTP %s et ne retente pas la requête', async (status) => {
    vi.stubEnv('LEBONCOIN_SERVICE_URL', 'http://127.0.0.1:8001');
    vi.stubEnv('LEBONCOIN_SERVICE_TOKEN', 'private-token');
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status, headers: { 'Content-Type': 'application/json' } }),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(getLeboncoinAd('1234567890')).rejects.toMatchObject({
      code:
        status === 404
          ? 'LEBONCOIN_LISTING_NOT_FOUND'
          : status === 403
            ? 'MANUAL_IMPORT_REQUIRED'
            : 'LEBONCOIN_SERVICE_UNAVAILABLE',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('utilise uniquement l’endpoint interne configuré et refuse ses redirections', async () => {
    vi.stubEnv('LEBONCOIN_SERVICE_URL', 'http://127.0.0.1:8001');
    vi.stubEnv('LEBONCOIN_SERVICE_TOKEN', 'private-token');
    const fetch = vi.fn().mockResolvedValue(Response.json(fixture));
    vi.stubGlobal('fetch', fetch);
    expect(await getLeboncoinAd('1234567890')).toEqual(fixture);
    expect(String(fetch.mock.calls[0][0])).toBe('http://127.0.0.1:8001/ads/1234567890');
    expect(fetch.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store' });
    vi.stubEnv('LEBONCOIN_SERVICE_URL', 'http://evil.example.org');
    await expect(getLeboncoinAd('1234567890')).rejects.toMatchObject({
      code: 'LEBONCOIN_SERVICE_UNAVAILABLE',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
