import type { NormalizedProperty } from '../listing-providers/normalized';
export type Comparable = {
  id: string;
  price: number;
  surface: number;
  propertyType: string;
  date: string;
  latitude: number;
  longitude: number;
};
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (v: number) => (v * Math.PI) / 180;
  const a =
    Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function comparableStatistics(
  property: NormalizedProperty,
  rows: Comparable[],
  now = new Date(),
) {
  if (
    property.surface === null ||
    property.latitude === null ||
    property.longitude === null ||
    !property.propertyType
  )
    return null;
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 3);
  const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
  const comparable = unique.filter(
    (r) =>
      r.price > 0 &&
      r.surface >= property.surface! * 0.75 &&
      r.surface <= property.surface! * 1.25 &&
      r.propertyType === property.propertyType &&
      new Date(r.date) >= cutoff &&
      new Date(r.date) <= now &&
      distanceMeters(property.latitude!, property.longitude!, r.latitude, r.longitude) <= 1000,
  );
  if (!comparable.length) return null;
  const values = comparable.map((r) => r.price / r.surface).sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const middle = Math.floor(values.length / 2);
  return {
    count: values.length,
    median: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
    mean,
    dispersion: Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length),
    recent: comparable.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
    radiusMeters: 1000,
    years: 3,
    surfaceTolerance: 0.25,
  };
}
export type EnrichmentResult = {
  geocoding: {
    latitude: number;
    longitude: number;
    inseeCode: string;
    commune: string;
    label: string;
    confidence: number;
    source: string;
    sourceUrl: string;
    retrievedAt: string;
  } | null;
  market: ReturnType<typeof comparableStatistics> | null;
  marketSource: {
    source: string;
    sourceUrl: string;
    retrievedAt: string;
    confidence: number;
  } | null;
  dpeCandidates: {
    dpe: string;
    ges: string | null;
    date: string;
    surface: number;
    confidence: number;
    sourceUrl: string;
  }[];
  warnings: string[];
};
export interface PublicDataProvider {
  readonly dvfSourceUrl?: string;
  geocode(property: NormalizedProperty): Promise<EnrichmentResult['geocoding']>;
  comparables(property: NormalizedProperty, inseeCode: string): Promise<Comparable[]>;
  dpe(property: NormalizedProperty): Promise<EnrichmentResult['dpeCandidates']>;
}
export class PropertyEnrichmentService {
  constructor(private provider: PublicDataProvider) {}
  async enrich(property: NormalizedProperty): Promise<EnrichmentResult> {
    const result: EnrichmentResult = {
      geocoding: null,
      market: null,
      marketSource: null,
      dpeCandidates: [],
      warnings: [],
    };
    if (!property.address || !property.postalCode || !property.city) {
      result.warnings.push(
        'Adresse précise manquante : géocodage et rapprochement DPE indisponibles.',
      );
      return result;
    }
    try {
      result.geocoding = await this.provider.geocode(property);
    } catch {
      result.warnings.push('Service BAN temporairement indisponible.');
    }
    if (!result.geocoding) {
      result.warnings.push('Aucune adresse BAN suffisamment fiable.');
      return result;
    }
    const enriched = {
      ...property,
      latitude: result.geocoding.latitude,
      longitude: result.geocoding.longitude,
    };
    await Promise.all([
      (async () => {
        try {
          result.market = comparableStatistics(
            enriched,
            await this.provider.comparables(enriched, result.geocoding!.inseeCode),
          );
          if (result.market)
            result.marketSource = {
              source: 'DVF+ CEREMA',
              sourceUrl:
                this.provider.dvfSourceUrl ??
                'https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres',
              retrievedAt: new Date().toISOString(),
              confidence: result.market.count >= 10 ? 0.8 : 0.4,
            };
          else result.warnings.push('Aucune transaction DVF comparable disponible.');
        } catch {
          result.warnings.push('DVF indisponible : aucune valeur de marché inventée.');
        }
      })(),
      (async () => {
        try {
          result.dpeCandidates = await this.provider.dpe(enriched);
        } catch {
          result.warnings.push('DPE ADEME indisponible.');
        }
      })(),
    ]);
    return result;
  }
}
