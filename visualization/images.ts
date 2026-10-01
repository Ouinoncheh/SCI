import sharp from 'sharp';
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export async function normalizePhoto(input: Buffer) {
  if (!input.length || input.length > MAX_PHOTO_BYTES) throw new Error('Photo limitée à 8 Mo.');
  const options = { limitInputPixels: 40_000_000, failOn: 'warning' as const };
  const metadata = await sharp(input, options).metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
    throw new Error('Choisissez une image JPEG, PNG ou WebP non animée.');
  // Re-encoding strips EXIF/GPS and rejects malformed files; never serve uploaded bytes directly.
  const { data, info } = await sharp(input, options)
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumbnail = await sharp(data)
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  return { image: data, thumbnail, width: info.width, height: info.height };
}
