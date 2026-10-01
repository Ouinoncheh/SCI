import { PropertyNormalizer } from './normalized';
import { normalizeListingText } from './text';
import { publicHttps } from './import-types';
import { ListingProviderError, type ListingProvider } from './provider';
export class ManualListingProvider implements ListingProvider {
  constructor(private text?: string) {}
  canHandle(url: string) {
    return publicHttps(url);
  }
  extractExternalId() {
    return null;
  }
  async fetchListing(url: string) {
    if (!this.canHandle(url)) throw new ListingProviderError('INVALID_URL');
    return this.text !== undefined
      ? normalizeListingText(this.text, url)
      : new PropertyNormalizer().normalize(url, {}, 'MANUAL', 0);
  }
}
