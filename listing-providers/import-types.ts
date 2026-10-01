import { z } from 'zod';
import { propertyValuesSchema } from './normalized';
export function publicHttps(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}
export const webUrl = z.string().max(2048).refine(publicHttps, 'URL HTTPS publique requise.');
export const listingAttachmentSchema = z
  .object({
    sourceUrl: webUrl,
    method: z.enum(['url', 'html', 'text']),
    photos: z.array(webUrl).max(20),
    photoRights: z.literal(true),
    draftId: z.string().min(1).max(100).optional(),
    normalized: propertyValuesSchema.optional(),
  })
  .strict();
export type ListingAttachment = z.infer<typeof listingAttachmentSchema>;
export type ImportedListing = {
  sourceUrl: string;
  title: string | null;
  description: string;
  price: number | null;
  area: number | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  rooms: number | null;
  dpe: string | null;
  photos: string[];
  warnings: string[];
};
