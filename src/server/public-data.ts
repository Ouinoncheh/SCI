import { z } from 'zod';
import type { NormalizedProperty } from '../listing-providers/normalized';
import {
  distanceMeters,
  type PublicDataProvider,
  type EnrichmentResult,
  type Comparable,
} from '../market-data/enrichment';
async function getJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Source indisponible');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Réponse vide');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new Error('Source trop volumineuse');
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const geoSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({
        score: z.number(),
        type: z.string(),
        citycode: z.string(),
        city: z.string(),
        label: z.string(),
        postcode: z.string(),
      }),
    }),
  ),
});
const dvfSchema = z.object({
  results: z.array(
    z
      .object({
        idnatmut: z.string(),
        valeurfonc: z.coerce.number(),
        sbati: z.coerce.number(),
        codtypbien: z.string(),
        datemut: z.string(),
        longitude: z.coerce.number().optional(),
        latitude: z.coerce.number().optional(),
      })
      .passthrough(),
  ),
});
export class FrenchPublicDataProvider implements PublicDataProvider {
  get dvfSourceUrl() {
    const configured = process.env.CEREMA_DVF_URL;
    if (!configured) return undefined;
    const url = new URL(configured);
    return `${url.origin}/dvf_opendata/mutations`;
  }
  async geocode(p: NormalizedProperty): Promise<EnrichmentResult['geocoding']> {
    const url = new URL('https://data.geopf.fr/geocodage/search');
    url.searchParams.set('q', `${p.address} ${p.postalCode} ${p.city}`);
    url.searchParams.set('limit', '3');
    url.searchParams.set('index', 'address');
    const parsed = geoSchema.parse(await getJson(url));
    const top = parsed.features[0];
    if (
      !top ||
      top.properties.score < 0.9 ||
      top.properties.type !== 'housenumber' ||
      top.properties.postcode !== p.postalCode ||
      (parsed.features[1]?.properties.score ?? 0) > top.properties.score - 0.05
    )
      return null;
    return {
      longitude: top.geometry.coordinates[0],
      latitude: top.geometry.coordinates[1],
      inseeCode: top.properties.citycode,
      commune: top.properties.city,
      label: top.properties.label,
      confidence: top.properties.score,
      source: 'BAN / IGN',
      sourceUrl: url.href,
      retrievedAt: new Date().toISOString(),
    };
  }
  async comparables(p: NormalizedProperty, inseeCode: string): Promise<Comparable[]> {
    // Official client documents the preproduction API. Production URL must be configured explicitly.
    const configured = process.env.CEREMA_DVF_URL;
    if (!configured) throw new Error('DVF non configuré');
    const url = new URL(configured);
    if (
      url.protocol !== 'https:' ||
      !['apidf.cerema.fr', 'apidf-preprod.cerema.fr'].includes(url.hostname)
    )
      throw new Error('Source DVF refusée');
    url.pathname = '/dvf_opendata/mutations';
    url.search = '';
    url.searchParams.set('code_insee', inseeCode);
    url.searchParams.set('page_size', '500');
    url.searchParams.set('fields', 'all');
    url.searchParams.set('anneemut_min', String(new Date().getFullYear() - 3));
    url.searchParams.set('codtypbien', p.propertyType === 'HOUSE' ? '111' : '121');
    const parsed = dvfSchema.parse(await getJson(url));
    // Missing coordinates prevent distance filtering: reject those observations rather than treating them as nearby.
    return parsed.results.flatMap((r) =>
      r.latitude === undefined || r.longitude === undefined
        ? []
        : [
            {
              id: r.idnatmut,
              price: r.valeurfonc,
              surface: r.sbati,
              propertyType:
                r.codtypbien === '111' ? 'HOUSE' : r.codtypbien === '121' ? 'APARTMENT' : 'OTHER',
              date: r.datemut,
              latitude: r.latitude,
              longitude: r.longitude,
            },
          ],
    );
  }
  async dpe(p: NormalizedProperty): Promise<EnrichmentResult['dpeCandidates']> {
    const url = new URL(
      'https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines',
    );
    url.searchParams.set('q', `${p.address} ${p.postalCode} ${p.city}`);
    url.searchParams.set('size', '20');
    const data = z.object({ results: z.array(z.record(z.unknown())) }).parse(await getJson(url));
    // Address, distance and surface must agree. Candidates always require confirmation, especially in shared buildings.
    return data.results.flatMap((r) => {
      const label = String(r['Adresse_(BAN)'] ?? r['adresse_ban'] ?? '').toLocaleLowerCase();
      const lat = Number(r['Coordonnée_cartographique_Y_(BAN)'] ?? r['latitude']);
      const lon = Number(r['Coordonnée_cartographique_X_(BAN)'] ?? r['longitude']);
      const surface = Number(r['Surface_habitable_logement'] ?? r['surface_habitable_logement']);
      const dpe = String(r['Etiquette_DPE'] ?? r['etiquette_dpe']);
      const ges = String(r['Etiquette_GES'] ?? r['etiquette_ges']);
      if (
        !/^[A-G]$/.test(dpe) ||
        !p.address ||
        !label.includes(p.address.toLocaleLowerCase()) ||
        !p.surface ||
        !Number.isFinite(surface) ||
        Math.abs(surface - p.surface) > p.surface * 0.05 ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180 ||
        p.latitude === null ||
        p.longitude === null ||
        distanceMeters(p.latitude, p.longitude, lat, lon) > 30
      )
        return [];
      return [
        {
          dpe,
          ges: /^[A-G]$/.test(ges) ? ges : null,
          date: String(r['Date_établissement_DPE'] ?? ''),
          surface,
          confidence: 0.9,
          sourceUrl: url.href,
        },
      ];
    });
  }
}
