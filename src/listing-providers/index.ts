import { extractListingText } from './text';
export type ListingDraft = {
  sourceUrl: string | null;
  description: string;
  title: string | null;
  price: number | null;
  area: number | null;
  city?: string | null;
  postcode?: string | null;
  confidence: 'USER_PROVIDED';
};
export interface TextListingProvider {
  id: string;
  fetchListing(input: string): Promise<string>;
  normalizeListing(raw: string): ListingDraft;
  extractPropertyData(raw: string): Partial<ListingDraft>;
}
/** Reads only user-supplied text. Never fetches a portal URL. All fields require confirmation. */
export class UserTextProvider implements TextListingProvider {
  id = 'user-text';
  async fetchListing(input: string) {
    return input.slice(0, 20000);
  }
  extractPropertyData(raw: string): Partial<ListingDraft> {
    const detected = extractListingText(raw);
    const price = raw.match(/(\d[\d\s\u00a0]*)\s*€/);
    const area = raw.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i);
    return {
      city: detected.city ?? null,
      postcode: detected.postalCode ?? null,
      price: price ? Number(price[1].replace(/\s/g, '')) : null,
      area: area ? Number(area[1].replace(',', '.')) : null,
    };
  }
  normalizeListing(raw: string): ListingDraft {
    return {
      sourceUrl: null,
      description: raw.slice(0, 20000),
      title: null,
      price: null,
      area: null,
      confidence: 'USER_PROVIDED',
      ...this.extractPropertyData(raw),
    };
  }
}
