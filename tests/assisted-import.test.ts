import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ListingImporter, StructuredHtmlProvider } from '../src/listing-providers/importer';
import { PropertyNormalizer } from '../src/listing-providers/normalized';
import { normalizeListingText } from '../src/listing-providers/text';
import { ListingFetchError, safeLogUrl } from '../src/server/import-log';
import { comparableStatistics, PropertyEnrichmentService } from '../src/market-data/enrichment';
import { analyzeImport } from '../src/listing-providers/analysis';
import { properties } from '../src/data/demo';
const url = 'https://agence.example.org/annonce/123456';
describe('import assisté sans requêtes portail', () => {
  it('attend les hypothèses valides et calcule les mêmes projections pour tout import', () => {
    expect(analyzeImport({ price: 245000, surface: 70 }, null)).toBeNull();
    const result = analyzeImport(properties[0].investment, 'C');
    expect(result?.tenYears.year).toBe(10);
    expect(result?.twentyYears.year).toBe(20);
    expect(result?.tenYears.tax).toBeNull();
  });
  it('normalise la fixture JSON-LD et garde les inconnues null', async () => {
    const download = vi.fn().mockRejectedValue(new Error('network forbidden'));
    const result = await new ListingImporter(new StructuredHtmlProvider(download)).import(url, {
      html: readFileSync('tests/fixtures/listing.html', 'utf8'),
    });
    expect(download).not.toHaveBeenCalled();
    expect(result.status).toBe('READY');
    expect(result.normalized).toMatchObject({
      price: 245000,
      surface: 70,
      bedrooms: null,
      propertyTax: null,
    });
    expect(result.normalized.confidence.price).toMatchObject({
      value: 245000,
      source: 'STRUCTURED_HTML',
      sourceUrl: url,
    });
  });
  it.each([401, 403, 405, 429])(
    'conserve le lien et fournit le repli après HTTP %s',
    async (status) => {
      const download = vi.fn().mockRejectedValue(
        new ListingFetchError({
          url,
          provider: 'fixture',
          method: 'GET',
          status,
          allow: 'GET',
          contentType: 'text/html',
          stage: 'remote_response',
        }),
      );
      const result = await new ListingImporter(new StructuredHtmlProvider(download)).import(url);
      expect(result.status).toBe('NEEDS_IMPORT_DATA');
      expect(result.normalized.sourceUrl).toBe(url);
      expect(result.normalized.price).toBeNull();
      expect(result.message).toContain('Ajoutez le contenu');
      expect(download).toHaveBeenCalledTimes(1);
    },
  );
  it('extrait texte, faux explicites et provenance sans inventer les champs absents', () => {
    const result = normalizeListingText(
      'Appartement\nPrix : 18000 €\nSurface : 60 m²\n3 pièces, 2 chambres\n44000 Nantes\nSans ascenseur\nAvec balcon\nDPE : C\nGES : D\nTaxe foncière : 900 €',
      url,
    );
    expect(result).toMatchObject({
      price: 18000,
      postalCode: '44000',
      surface: 60,
      rooms: 3,
      bedrooms: 2,
      elevator: false,
      balcony: true,
      parking: null,
      propertyTax: 900,
      condominiumFees: null,
    });
    expect(normalizeListingText('Prix : 18000 €', url).postalCode).toBeNull();
    expect(result.confidence.price?.source).toBe('USER_PROVIDED_LISTING_TEXT');
  });
  it('supprime secrets URL et identifiants des logs', () => {
    expect(safeLogUrl('https://user:secret@example.org/ad/123?token=secret#secret')).toBe(
      'https://example.org/ad/123',
    );
  });
  it('filtre distance, type, date, surface et doublons des comparables', () => {
    const p = new PropertyNormalizer().normalize(
      url,
      { surface: 60, propertyType: 'APARTMENT', latitude: 47.2, longitude: -1.5 },
      'fixture',
    );
    const row = {
      id: 'a',
      price: 180000,
      surface: 60,
      propertyType: 'APARTMENT',
      latitude: 47.2,
      longitude: -1.5,
      date: '2026-01-01',
    };
    const stats = comparableStatistics(
      p,
      [
        row,
        row,
        { ...row, id: 'b', price: 240000 },
        { ...row, id: 'far', latitude: 48 },
        { ...row, id: 'old', date: '2020-01-01' },
        { ...row, id: 'house', propertyType: 'HOUSE' },
        { ...row, id: 'large', surface: 200 },
      ],
      new Date('2026-10-01'),
    );
    expect(stats).toMatchObject({ count: 2, median: 3500, mean: 3500, dispersion: 500 });
  });
  it('ne lance aucune recherche sans adresse précise et ne fabrique pas de DPE', async () => {
    const geocode = vi.fn();
    const provider = { geocode, comparables: vi.fn(), dpe: vi.fn() };
    const p = new PropertyNormalizer().normalize(url, {}, 'fixture');
    const result = await new PropertyEnrichmentService(provider).enrich(p);
    expect(geocode).not.toHaveBeenCalled();
    expect(result.market).toBeNull();
    expect(result.dpeCandidates).toEqual([]);
  });
});
