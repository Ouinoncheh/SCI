import { z } from 'zod';
import { webUrl } from './urls';
const text = (max = 300) => z.string().trim().min(1).max(max).nullable();
const amount = z.number().finite().nonnegative().max(1e10).nullable();
const count = z.number().int().nonnegative().max(100).nullable();
const flag = z.boolean().nullable();
export const propertyValuesSchema = z
  .object({
    title: text(120),
    description: text(20000),
    propertyType: z.enum(['HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OTHER']).nullable(),
    price: amount,
    surface: z.number().finite().positive().max(100000).nullable(),
    rooms: count,
    bedrooms: count,
    address: text(),
    postalCode: z
      .string()
      .regex(/^\d{5}$/)
      .nullable(),
    city: text(100),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    floor: z.number().int().min(-10).max(200).nullable(),
    totalFloors: z.number().int().min(0).max(200).nullable(),
    elevator: flag,
    balcony: flag,
    terrace: flag,
    garden: flag,
    parking: flag,
    garage: flag,
    cellar: flag,
    dpe: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).nullable(),
    ges: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).nullable(),
    condominiumFees: amount,
    propertyTax: amount,
    agencyFees: amount,
    images: z.array(webUrl).max(20),
    publishedAt: z.string().datetime().nullable(),
  })
  .strict();
export type PropertyValues = z.infer<typeof propertyValuesSchema>;
export type FieldEvidence = {
  value: unknown;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  confidence: number;
};
export type NormalizedProperty = PropertyValues & {
  sourceUrl: string;
  source: string;
  sourceListingId: string | null;
  importedAt: string;
  confidence: Partial<Record<keyof PropertyValues, FieldEvidence>>;
  rawAttributes?: Record<string, unknown>;
  pricePerSquareMeter?: number | null;
  importStatus?: 'PENDING' | 'IMPORTED' | 'PARTIAL' | 'NEEDS_MANUAL_IMPORT' | 'FAILED';
};
export const emptyValues = (): PropertyValues => ({
  title: null,
  description: null,
  propertyType: null,
  price: null,
  surface: null,
  rooms: null,
  bedrooms: null,
  address: null,
  postalCode: null,
  city: null,
  latitude: null,
  longitude: null,
  floor: null,
  totalFloors: null,
  elevator: null,
  balcony: null,
  terrace: null,
  garden: null,
  parking: null,
  garage: null,
  cellar: null,
  dpe: null,
  ges: null,
  condominiumFees: null,
  propertyTax: null,
  agencyFees: null,
  images: [],
  publishedAt: null,
});
export function sourceInfo(url: string) {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  return {
    source:
      host === 'leboncoin.fr'
        ? 'LEBONCOIN'
        : host === 'seloger.com' || host.endsWith('.seloger.com')
          ? 'SELOGER'
          : host,
    sourceListingId: u.pathname.match(/\/(\d{6,})(?:\/|\.htm|$)/)?.[1] ?? null,
  };
}
export class PropertyNormalizer {
  normalize(
    url: string,
    values: Partial<PropertyValues>,
    evidenceSource: string,
    confidence = 0.8,
    now = new Date().toISOString(),
  ): NormalizedProperty {
    const parsed = propertyValuesSchema.parse({ ...emptyValues(), ...values });
    const evidence: NormalizedProperty['confidence'] = {};
    for (const [key, value] of Object.entries(parsed))
      if (value !== null && (!Array.isArray(value) || value.length))
        evidence[key as keyof PropertyValues] = {
          value,
          source: evidenceSource,
          sourceUrl: url,
          retrievedAt: now,
          confidence,
        };
    return { ...parsed, sourceUrl: url, ...sourceInfo(url), importedAt: now, confidence: evidence };
  }
}
export const fieldLabels: Record<keyof PropertyValues, string> = {
  title: 'Titre',
  description: 'Description',
  propertyType: 'Type de bien',
  price: 'Prix (€)',
  surface: 'Surface (m²)',
  rooms: 'Pièces',
  bedrooms: 'Chambres',
  address: 'Adresse',
  postalCode: 'Code postal',
  city: 'Ville',
  latitude: 'Latitude',
  longitude: 'Longitude',
  floor: 'Étage',
  totalFloors: 'Nombre d’étages',
  elevator: 'Ascenseur',
  balcony: 'Balcon',
  terrace: 'Terrasse',
  garden: 'Jardin',
  parking: 'Parking',
  garage: 'Garage',
  cellar: 'Cave',
  dpe: 'DPE',
  ges: 'GES',
  condominiumFees: 'Charges de copropriété annuelles (€)',
  propertyTax: 'Taxe foncière annuelle (€)',
  agencyFees: 'Frais d’agence restant à charge (€)',
  images: 'Images',
  publishedAt: 'Date de publication',
};
