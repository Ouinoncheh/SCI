import { describe, expect, it } from 'vitest';
import { parseListingHtml } from '../src/listing-providers/html';
import { allowedListingUrl, isPublicAddress } from '../src/server/listing-fetch';
import { listingAttachmentSchema, publicHttps } from '../src/listing-providers/import-types';
const source = 'https://agence.example.org/annonce/1';
const html = (value: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
describe('import des annonces', () => {
  it('extrait un bien structuré sans charger de ressource', () => {
    const result = parseListingHtml(
      html({
        '@type': 'Apartment',
        name: 'Appartement',
        description: 'DPE : C',
        offers: { price: '180000', priceCurrency: 'EUR' },
        floorSize: { value: 60, unitCode: 'MTK' },
        numberOfRooms: 3,
        address: { addressLocality: 'Nantes', postalCode: '44000', streetAddress: 'Rue exemple' },
        image: [
          '/photo.jpg',
          { contentUrl: 'https://images.example.org/2.jpg' },
          'javascript:alert(1)',
        ],
      }),
      source,
    );
    expect(result).toMatchObject({
      title: 'Appartement',
      price: 180000,
      area: 60,
      rooms: 3,
      city: 'Nantes',
      postcode: '44000',
      dpe: 'C',
    });
    expect(result.photos).toEqual([
      'https://agence.example.org/photo.jpg',
      'https://images.example.org/2.jpg',
    ]);
  });
  it('garde les données absentes, devises et unités ambiguës indisponibles', () => {
    const result = parseListingHtml(
      html({
        '@type': 'House',
        offers: { price: 1000, priceCurrency: 'USD' },
        floorSize: { value: 100, unitCode: 'FTK' },
      }),
      source,
    );
    expect(result.price).toBeNull();
    expect(result.area).toBeNull();
    expect(result.city).toBeNull();
  });
  it('ne mélange pas les caractéristiques de plusieurs annonces', () => {
    const result = parseListingHtml(
      html([
        { '@type': 'House', numberOfRooms: 2 },
        { '@type': 'House', numberOfRooms: 8 },
      ]),
      source,
    );
    expect(result.rooms).toBeNull();
    expect(result.warnings.join(' ')).toContain('Plusieurs biens');
  });
  it('lit les métadonnées malgré du JSON malformé et ne restitue pas de HTML actif', () => {
    const result = parseListingHtml(
      '<meta property="og:title" content="&lt;img src=x onerror=alert(1)&gt;Appartement"><script type="application/ld+json">{broken</script>',
      source,
    );
    expect(result.title).toBe('Appartement');
    expect(result.price).toBeNull();
  });
  it('refuse les URL locales, identifiants et protocoles actifs', () => {
    for (const url of [
      'http://example.org',
      'https://127.0.0.1',
      'https://[::1]',
      'https://user:pass@example.org',
      'file:///etc/passwd',
      'https://host.local',
      'https://example.org:444',
    ])
      expect(publicHttps(url)).toBe(false);
  });
  it('exige un domaine exact autorisé et des IP publiques', () => {
    expect(() => allowedListingUrl(source, [])).toThrow('pas connectée');
    expect(() =>
      allowedListingUrl('https://agence.example.org.evil.org', ['agence.example.org']),
    ).toThrow();
    expect(allowedListingUrl(source, ['agence.example.org']).hostname).toBe('agence.example.org');
    for (const ip of [
      '127.0.0.1',
      '10.0.0.1',
      '169.254.169.254',
      '::1',
      '::ffff:127.0.0.1',
      'fc00::1',
      '192.168.1.2',
      '100.64.0.1',
    ])
      expect(isPublicAddress(ip)).toBe(false);
    expect(isPublicAddress('8.8.8.8')).toBe(true);
  });
  it('borne la page et les photos, impose les droits déclarés', () => {
    expect(() => parseListingHtml('x'.repeat(2_000_001), source)).toThrow();
    expect(
      listingAttachmentSchema.safeParse({
        sourceUrl: source,
        method: 'html',
        photos: [],
        photoRights: false,
      }).success,
    ).toBe(false);
    expect(
      listingAttachmentSchema.safeParse({
        sourceUrl: source,
        method: 'html',
        photos: Array(21).fill(source),
        photoRights: true,
      }).success,
    ).toBe(false);
  });
});
