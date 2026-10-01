import { load } from 'cheerio';
import { parseListingHtml } from './html';
import {
  PropertyNormalizer,
  emptyValues,
  type NormalizedProperty,
  type PropertyValues,
} from './normalized';
import { extractListingText, normalizeListingText } from './text';
import { LeboncoinProvider } from './leboncoin';
import { ManualListingProvider } from './manual';
import { isLeboncoinUrl, ListingProviderError, type ListingErrorCode } from './provider';
export interface ContentListingProvider {
  id: string;
  fetchListing(url: string): Promise<string>;
  extractPropertyData(content: string, url: string): NormalizedProperty;
}
export class StructuredHtmlProvider implements ContentListingProvider {
  id = 'authorized-html';
  constructor(private download: (url: string) => Promise<string>) {}
  fetchListing(url: string) {
    return this.download(url);
  }
  extractPropertyData(html: string, url: string) {
    const data = parseListingHtml(html, url);
    const $ = load(html);
    const homes: Record<string, unknown>[] = [];
    const walk = (value: unknown, depth = 0) => {
      if (depth > 12) return;
      if (Array.isArray(value)) {
        value.forEach((v) => walk(v, depth + 1));
        return;
      }
      if (value && typeof value === 'object') {
        const node = value as Record<string, unknown>;
        if (
          ['Apartment', 'House', 'SingleFamilyResidence', 'Residence', 'Accommodation'].includes(
            String(node['@type']),
          )
        )
          homes.push(node);
        Object.values(node).forEach((v) => {
          if (v && typeof v === 'object') walk(v, depth + 1);
        });
      }
    };
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        walk(JSON.parse($(el).text()));
      } catch {
        /* Inert malformed JSON. */
      }
    });
    const home = homes.length === 1 ? homes[0] : {};
    const structured: Partial<PropertyValues> = {};
    if (home['@type'] === 'Apartment') structured.propertyType = 'APARTMENT';
    if (['House', 'SingleFamilyResidence'].includes(String(home['@type'])))
      structured.propertyType = 'HOUSE';
    if (typeof home.numberOfBedrooms === 'number') structured.bedrooms = home.numberOfBedrooms;
    if (typeof home.floorLevel === 'number') structured.floor = home.floorLevel;
    const geo = home.geo as Record<string, unknown> | undefined;
    if (typeof geo?.latitude === 'number') structured.latitude = geo.latitude;
    if (typeof geo?.longitude === 'number') structured.longitude = geo.longitude;
    if (typeof home.datePosted === 'string' && Number.isFinite(Date.parse(home.datePosted)))
      structured.publishedAt = new Date(home.datePosted).toISOString();
    $('script,style,nav,footer,header,aside').remove();
    $('p,div,li,br,tr').each((_, el) => {
      $(el).append('\n');
    });
    const body = $('main').length ? $('main').first().text() : $('body').text();
    const fallback = extractListingText(body);
    const values: Partial<PropertyValues> = {
      ...fallback,
      ...structured,
      title: data.title ?? fallback.title,
      description: data.description || fallback.description,
      price: data.price ?? fallback.price,
      surface: data.area ?? fallback.surface,
      rooms: data.rooms ?? fallback.rooms,
      city: data.city ?? fallback.city,
      postalCode: data.postcode ?? fallback.postalCode,
      address: data.address ?? fallback.address,
      dpe: (data.dpe as PropertyValues['dpe']) ?? fallback.dpe,
      images: data.photos,
    };
    if (data.warnings.some((w) => w.startsWith('Plusieurs biens'))) {
      return new PropertyNormalizer().normalize(
        url,
        { title: data.title, description: data.description || null },
        'AMBIGUOUS_HTML',
        0.3,
      );
    }
    return new PropertyNormalizer().normalize(url, values, 'STRUCTURED_HTML', 0.85);
  }
}
export type ImportResult = {
  status: 'NEEDS_IMPORT_DATA' | 'READY' | 'NEEDS_MANUAL_IMPORT';
  normalized: NormalizedProperty;
  message: string | null;
  errorCode?: ListingErrorCode;
};
export class ListingImporter {
  constructor(
    private provider: ContentListingProvider,
    private leboncoin?: LeboncoinProvider,
  ) {}
  async import(url: string, input?: { html?: string; text?: string }): Promise<ImportResult> {
    const automaticLeboncoin =
      isLeboncoinUrl(url) && input?.html === undefined && input?.text === undefined;
    try {
      const normalized =
        input?.text !== undefined
          ? normalizeListingText(input.text, url)
          : automaticLeboncoin
            ? await (
                this.leboncoin ??
                new LeboncoinProvider(async () => {
                  throw new ListingProviderError('LEBONCOIN_SERVICE_UNAVAILABLE');
                })
              ).fetchListing(url)
            : this.provider.extractPropertyData(
                input?.html ?? (await this.provider.fetchListing(url)),
                url,
              );
      if (automaticLeboncoin)
        normalized.importStatus =
          normalized.price !== null && normalized.surface !== null ? 'IMPORTED' : 'PARTIAL';
      return {
        status:
          normalized.price !== null && normalized.surface !== null ? 'READY' : 'NEEDS_IMPORT_DATA',
        normalized,
        message: null,
      };
    } catch (error) {
      if (automaticLeboncoin) {
        const normalized = await new ManualListingProvider().fetchListing(url);
        normalized.importStatus = 'NEEDS_MANUAL_IMPORT';
        return {
          status: 'NEEDS_MANUAL_IMPORT',
          normalized,
          message: new ListingProviderError('MANUAL_IMPORT_REQUIRED').message,
          errorCode: error instanceof ListingProviderError ? error.code : 'LEBONCOIN_IMPORT_FAILED',
        };
      }
      return {
        status: 'NEEDS_IMPORT_DATA',
        normalized: new PropertyNormalizer().normalize(url, emptyValues(), 'UNAVAILABLE', 0),
        message:
          'Cette plateforme ne permet pas l’import automatique depuis notre serveur. Ajoutez le contenu de l’annonce pour continuer.',
      };
    }
  }
}
