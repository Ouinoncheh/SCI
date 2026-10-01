import type { NormalizedProperty } from './normalized';

export type ListingErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROVIDER'
  | 'LISTING_ID_NOT_FOUND'
  | 'LEBONCOIN_SERVICE_UNAVAILABLE'
  | 'LEBONCOIN_LISTING_NOT_FOUND'
  | 'LEBONCOIN_IMPORT_FAILED'
  | 'MANUAL_IMPORT_REQUIRED';
export class ListingProviderError extends Error {
  constructor(public code: ListingErrorCode) {
    super(
      'L’import automatique n’est pas disponible pour cette annonce. Vous pouvez compléter les informations manuellement.',
    );
  }
}
export interface ListingProvider {
  canHandle(url: string): boolean;
  extractExternalId(url: string): string | null;
  fetchListing(url: string): Promise<NormalizedProperty>;
}
export function isLeboncoinUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ['leboncoin.fr', 'www.leboncoin.fr', 'm.leboncoin.fr'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
export function extractLeboncoinAdId(raw: string): string | null {
  if (!isLeboncoinUrl(raw)) return null;
  const path = new URL(raw).pathname;
  return path.match(/^\/(?:ad\/)?[a-z_]+\/([1-9]\d{0,19})(?:\.htm)?\/?$/i)?.[1] ?? null;
}
