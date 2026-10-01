import { z } from 'zod';
export const roomTypes = [
  'Salon',
  'Salle à manger',
  'Cuisine',
  'Chambre',
  'Salle de bain',
  'Toilettes',
  'Entrée',
  'Couloir',
  'Bureau',
  'Balcon',
  'Terrasse',
  'Cave',
  'Garage',
  'Façade',
  'Extérieur',
  'Autre',
] as const;
export const roomSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    roomType: z.enum(roomTypes),
    floor: z.number().int().min(-10).max(200).nullable(),
    areaEstimate: z.number().finite().positive().max(10000).nullable(),
    notes: z.string().trim().max(2000),
  })
  .strict();
export const photoMetadataSchema = z
  .object({
    angleLabel: z.string().trim().max(100),
    comment: z.string().trim().max(2000),
  })
  .strict();
export type GalleryPhoto = {
  id: string;
  originalFilename: string;
  width: number;
  height: number;
  angleLabel: string;
  comment: string;
  uploadedAt: string;
  isCover: boolean;
};
export const photoUpdateSchema = photoMetadataSchema
  .extend({
    roomId: z.string().min(1).max(100),
    makeCover: z.boolean(),
    expected: photoMetadataSchema
      .extend({ roomId: z.string().min(1), isCover: z.boolean() })
      .strict(),
  })
  .strict();
export type GalleryRoom = z.infer<typeof roomSchema> & { id: string; photos: GalleryPhoto[] };
