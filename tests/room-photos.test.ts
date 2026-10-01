import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizePhoto, MAX_PHOTO_BYTES } from '../src/visualization/images';
import { roomSchema, photoUpdateSchema } from '../src/visualization/types';
describe('photos de pièces', () => {
  it('exige un état attendu et refuse les champs étrangers lors des modifications', () => {
    const input = {
      angleLabel: ' Entrée ',
      comment: '',
      roomId: 'room',
      makeCover: true,
      expected: { roomId: 'room', angleLabel: '', comment: '', isCover: false },
    };
    expect(photoUpdateSchema.parse(input).angleLabel).toBe('Entrée');
    expect(photoUpdateSchema.safeParse({ ...input, expected: undefined }).success).toBe(false);
    expect(photoUpdateSchema.safeParse({ ...input, sciId: 'foreign' }).success).toBe(false);
    expect(photoUpdateSchema.safeParse({ ...input, comment: 'x'.repeat(2001) }).success).toBe(
      false,
    );
  });
  it('redimensionne les images et retire les métadonnées', async () => {
    const source = await sharp({
      create: { width: 3000, height: 1500, channels: 3, background: '#aaccee' },
    })
      .jpeg()
      .withExif({ IFD0: { Artist: 'Private author' } })
      .toBuffer();
    const result = await normalizePhoto(source);
    expect([result.width, result.height]).toEqual([2048, 1024]);
    const output = await sharp(result.image).metadata();
    expect(output.format).toBe('webp');
    expect(output.exif).toBeUndefined();
    expect((await sharp(result.thumbnail).metadata()).width).toBe(480);
  });
  it('rejette HTML, SVG et fichiers trop volumineux', async () => {
    for (const data of [
      Buffer.from('<html>bad</html>'),
      Buffer.from('<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"/>'),
      Buffer.alloc(MAX_PHOTO_BYTES + 1),
    ])
      await expect(normalizePhoto(data)).rejects.toThrow();
  });
  it('accepte les données inconnues sans inventer de surface', () => {
    const room = {
      name: 'Cuisine',
      roomType: 'Cuisine',
      floor: null,
      areaEstimate: null,
      notes: '',
    };
    expect(roomSchema.parse(room)).toEqual(room);
    expect(roomSchema.safeParse({ ...room, areaEstimate: -1 }).success).toBe(false);
    expect(roomSchema.safeParse({ ...room, sciId: 'foreign' }).success).toBe(false);
  });
});
