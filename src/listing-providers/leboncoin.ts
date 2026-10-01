import { publicHttps } from './import-types';
import {
  emptyValues,
  PropertyNormalizer,
  propertyValuesSchema,
  type PropertyValues,
} from './normalized';
import {
  extractLeboncoinAdId,
  isLeboncoinUrl,
  ListingProviderError,
  type ListingProvider,
} from './provider';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const label = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
function numeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(',', '.')
    .replace(/(?:€|eur|euros|m²|m2)$/i, '');
  return /^-?\d+(?:\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}
function boolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (['oui', 'yes', 'true', '1'].includes(value.toLowerCase().trim())) return true;
    if (['non', 'no', 'false', '0'].includes(value.toLowerCase().trim())) return false;
  }
  return value === 1 ? true : value === 0 ? false : null;
}
export function parseLeboncoinAttributes(input: unknown): {
  values: Partial<PropertyValues>;
  rawAttributes: Record<string, unknown>;
} {
  const attributes: Record<string, unknown> = {};
  const put = (key: unknown, value: unknown) => {
    if (
      typeof key !== 'string' ||
      key.length > 120 ||
      ['__proto__', 'constructor', 'prototype'].includes(key) ||
      /cookie|token|password|authorization|secret/i.test(key)
    )
      return;
    if (typeof value === 'string') attributes[key] = value.slice(0, 1000);
    else if (
      (typeof value === 'number' && Number.isFinite(value)) ||
      typeof value === 'boolean' ||
      value === null
    )
      attributes[key] = value;
    else if (Array.isArray(value))
      attributes[key] = value
        .filter((v) => typeof v === 'string' || typeof v === 'number')
        .slice(0, 30);
  };
  if (Array.isArray(input))
    for (const item of input.slice(0, 150)) {
      const a = record(item);
      put(a.key, a.value ?? a.values);
      put(a.key_label, a.value_label ?? a.value);
    }
  else for (const [key, value] of Object.entries(record(input)).slice(0, 150)) put(key, value);
  const byKey = new Map(Object.entries(attributes).map(([key, value]) => [label(key), value]));
  const pick = (...keys: string[]) =>
    keys.map((key) => byKey.get(key)).find((value) => value !== undefined);
  const values: Partial<PropertyValues> = {};
  const numberKeys: Partial<Record<keyof PropertyValues, string[]>> = {
    surface: ['square', 'surface', 'surface_habitable'],
    rooms: ['rooms', 'pieces', 'nombre_de_pieces'],
    bedrooms: ['bedrooms', 'chambres', 'nombre_de_chambres'],
    floor: ['floor', 'etage'],
    totalFloors: ['total_floors', 'nombre_d_etages'],
    propertyTax: ['property_tax', 'taxe_fonciere', 'taxe_fonciere_annuelle'],
    condominiumFees: [
      'annual_condominium_fees',
      'charges_annuelles',
      'charges_annuelles_de_copropriete',
    ],
    agencyFees: ['agency_fees_excluded', 'frais_d_agence_a_charge_acquereur_hors_prix'],
  };
  for (const [key, keys] of Object.entries(numberKeys))
    Object.assign(values, { [key]: numeric(pick(...keys)) });
  for (const key of [
    'elevator',
    'balcony',
    'terrace',
    'garden',
    'parking',
    'garage',
    'cellar',
  ] as const) {
    const french = {
      elevator: 'ascenseur',
      balcony: 'balcon',
      terrace: 'terrasse',
      garden: 'jardin',
      parking: 'parking',
      garage: 'garage',
      cellar: 'cave',
    }[key];
    values[key] = boolean(pick(key, french));
  }
  const outside = pick('outside_access', 'exterieur');
  const parts = Array.isArray(outside)
    ? outside.map(String)
    : typeof outside === 'string'
      ? outside.split(/[,;/]/)
      : [];
  for (const part of parts.map(label)) {
    if (['balcony', 'balcon'].includes(part)) values.balcony = true;
    if (['terrace', 'terrasse'].includes(part)) values.terrace = true;
    if (['garden', 'jardin'].includes(part)) values.garden = true;
  }
  const type = String(pick('real_estate_type', 'type_de_bien') ?? '').toLowerCase();
  values.propertyType =
    (
      {
        '1': 'HOUSE',
        '2': 'APARTMENT',
        '3': 'LAND',
        maison: 'HOUSE',
        house: 'HOUSE',
        appartement: 'APARTMENT',
        apartment: 'APARTMENT',
        terrain: 'LAND',
        land: 'LAND',
      } as Record<string, PropertyValues['propertyType']>
    )[type] ?? null;
  values.dpe = String(
    pick('energy_rate', 'dpe', 'classe_energie') ?? '',
  ).toUpperCase() as PropertyValues['dpe'];
  values.ges = String(
    pick('ges', 'ges_rate', 'classe_climat') ?? '',
  ).toUpperCase() as PropertyValues['ges'];
  return { values, rawAttributes: attributes };
}
export function normalizeLeboncoinAd(input: unknown, sourceUrl: string) {
  const raw = record(input);
  const id = extractLeboncoinAdId(sourceUrl);
  if (
    !id ||
    String(raw.id) !== id ||
    !['title', 'body', 'price', 'attributes', 'location'].some((key) => key in raw)
  )
    throw new ListingProviderError('LEBONCOIN_IMPORT_FAILED');
  const location = record(raw.location);
  const attributes = parseLeboncoinAttributes(raw.attributes);
  const values: Record<string, unknown> = {
    ...emptyValues(),
    ...attributes.values,
    title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : null,
    description: typeof raw.body === 'string' ? raw.body.slice(0, 20000) : null,
    price: numeric(Array.isArray(raw.price) ? raw.price[0] : raw.price),
    city: location.city ?? location.city_label ?? null,
    postalCode: typeof location.zipcode === 'string' ? location.zipcode : null,
    address: location.address ?? null,
    latitude: numeric(location.lat),
    longitude: numeric(location.lng),
    images: Array.isArray(raw.images)
      ? raw.images.filter((v): v is string => typeof v === 'string' && publicHttps(v)).slice(0, 20)
      : [],
    publishedAt:
      typeof raw.first_publication_date === 'string' &&
      Number.isFinite(Date.parse(raw.first_publication_date))
        ? new Date(raw.first_publication_date).toISOString()
        : null,
  };
  // A malformed attribute must never discard the other fields or invent a value.
  for (const key of Object.keys(propertyValuesSchema.shape) as (keyof PropertyValues)[]) {
    const parsed = propertyValuesSchema.shape[key].safeParse(values[key]);
    values[key] = parsed.success ? parsed.data : key === 'images' ? [] : null;
  }
  const normalized = new PropertyNormalizer().normalize(
    sourceUrl,
    values as PropertyValues,
    'LEBONCOIN_SERVICE',
    0.8,
  );
  return {
    ...normalized,
    sourceListingId: id,
    rawAttributes: attributes.rawAttributes,
    pricePerSquareMeter:
      normalized.price !== null && normalized.surface !== null
        ? normalized.price / normalized.surface
        : null,
  };
}
export class LeboncoinProvider implements ListingProvider {
  constructor(private service: (adId: string) => Promise<unknown>) {}
  canHandle(url: string) {
    return isLeboncoinUrl(url);
  }
  extractExternalId(url: string) {
    return extractLeboncoinAdId(url);
  }
  async fetchListing(url: string) {
    if (!this.canHandle(url)) throw new ListingProviderError('UNSUPPORTED_PROVIDER');
    const id = this.extractExternalId(url);
    if (!id) throw new ListingProviderError('LISTING_ID_NOT_FOUND');
    return normalizeLeboncoinAd(await this.service(id), url);
  }
}
