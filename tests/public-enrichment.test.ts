import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { FrenchPublicDataProvider } from '../src/server/public-data';
import { PropertyNormalizer } from '../src/listing-providers/normalized';
const property = new PropertyNormalizer().normalize(
  'https://agence.example.org/annonce/1',
  {
    address: '10 rue Exemple',
    postalCode: '44000',
    city: 'Nantes',
    surface: 60,
    propertyType: 'APARTMENT',
    latitude: 47.21,
    longitude: -1.55,
  },
  'fixture',
);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('adaptateurs publics sur fixtures', () => {
  it('accepte une adresse BAN précise et conserve la provenance', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(readFileSync('tests/fixtures/geocoding.json', 'utf8')));
    vi.stubGlobal('fetch', fetchMock);
    expect(await new FrenchPublicDataProvider().geocode(property)).toMatchObject({
      inseeCode: '44109',
      latitude: 47.21,
      longitude: -1.55,
      source: 'BAN / IGN',
      confidence: 0.96,
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('data.geopf.fr/geocodage/search');
  });
  it('refuse les adresses ambiguës', async () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/geocoding.json', 'utf8'));
    fixture.features.push({
      ...fixture.features[0],
      properties: { ...fixture.features[0].properties, score: 0.94 },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(fixture)));
    expect(await new FrenchPublicDataProvider().geocode(property)).toBeNull();
  });
  it('exclut le DPE éloigné, projeté ou de mauvaise surface', async () => {
    const row = {
      'Adresse_(BAN)': '10 rue Exemple 44000 Nantes',
      latitude: 47.21,
      longitude: -1.55,
      Surface_habitable_logement: 60,
      Etiquette_DPE: 'C',
      Etiquette_GES: 'B',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            results: [
              row,
              { ...row, latitude: 48 },
              { ...row, latitude: 6700000, longitude: 350000 },
              { ...row, Surface_habitable_logement: 100 },
            ],
          }),
        ),
    );
    const candidates = await new FrenchPublicDataProvider().dpe(property);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].dpe).toBe('C');
    expect(property.dpe).toBeNull();
  });
  it('ne contacte pas un service DVF non configuré', async () => {
    vi.stubEnv('CEREMA_DVF_URL', '');
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(new FrenchPublicDataProvider().comparables(property, '44109')).rejects.toThrow(
      'non configuré',
    );
    expect(request).not.toHaveBeenCalled();
  });
});
