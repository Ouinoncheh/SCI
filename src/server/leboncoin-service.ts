import { ListingProviderError } from '../listing-providers/provider';

/** Only the server-configured endpoint is contacted; user URLs never become fetch targets. */
export async function getLeboncoinAd(adId: string): Promise<unknown> {
  if (!/^[1-9]\d{0,19}$/.test(adId)) throw new ListingProviderError('LISTING_ID_NOT_FOUND');
  let base: URL;
  try {
    base = new URL(process.env.LEBONCOIN_SERVICE_URL ?? '');
    const local = ['localhost', '127.0.0.1', 'leboncoin-service'].includes(base.hostname);
    if (
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== '/' ||
      !(base.protocol === 'https:' || (base.protocol === 'http:' && local)) ||
      !process.env.LEBONCOIN_SERVICE_TOKEN
    )
      throw new Error('configuration');
  } catch {
    throw new ListingProviderError('LEBONCOIN_SERVICE_UNAVAILABLE');
  }
  try {
    const response = await fetch(new URL(`/ads/${adId}`, base), {
      headers: {
        Authorization: `Bearer ${process.env.LEBONCOIN_SERVICE_TOKEN}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) {
      console.warn(JSON.stringify({
        provider: 'LEBONCOIN',
        listingId: adId,
        operation: 'CONNECTOR_RESPONSE',
        httpStatus: response.status,
      }));
      throw new ListingProviderError(
        response.status === 404
          ? 'LEBONCOIN_LISTING_NOT_FOUND'
          : response.status === 403
            ? 'MANUAL_IMPORT_REQUIRED'
            : 'LEBONCOIN_SERVICE_UNAVAILABLE',
      );
    }
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new ListingProviderError('LEBONCOIN_IMPORT_FAILED');
    const reader = response.body?.getReader();
    if (!reader) throw new ListingProviderError('LEBONCOIN_IMPORT_FAILED');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1_000_000) {
        await reader.cancel();
        throw new ListingProviderError('LEBONCOIN_IMPORT_FAILED');
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof ListingProviderError) throw error;
    if (error instanceof SyntaxError) throw new ListingProviderError('LEBONCOIN_IMPORT_FAILED');
    throw new ListingProviderError('LEBONCOIN_SERVICE_UNAVAILABLE');
  }
}
