export type ImportDiagnostic = {
  url: string;
  provider: string;
  method: string;
  status: number | null;
  allow: string | null;
  contentType: string | null;
  stage: string;
};
export function safeLogUrl(raw: string) {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname.replace(/\/[A-Za-z0-9_-]{32,}/g, '/[redacted]')}`;
  } catch {
    return '[invalid-url]';
  }
}
export function logImport(input: ImportDiagnostic) {
  console.info(
    JSON.stringify({
      event: 'listing_import',
      ...input,
      url: safeLogUrl(input.url),
      allow: input.allow?.slice(0, 100) ?? null,
      contentType: input.contentType?.slice(0, 100) ?? null,
    }),
  );
}
export class ListingFetchError extends Error {
  constructor(public diagnostic: ImportDiagnostic) {
    super('Import automatique indisponible.');
  }
}
