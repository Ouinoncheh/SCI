import { db } from './db';
import { HttpError, membership } from './security';
import { roomSchema, photoMetadataSchema, photoUpdateSchema } from '../visualization/types';
import { normalizePhoto } from '../visualization/images';
import { storeMedia, removeMedia } from './object-storage';

export async function roomAccess(userId: string, sciId: string, propertyId: string, write = false) {
  await membership(userId, sciId, write ? 'write' : 'read');
  if (!(await db.property.findFirst({ where: { id: propertyId, sciId }, select: { id: true } })))
    throw new HttpError(404, 'Bien introuvable.');
}
export async function listRooms(userId: string, sciId: string, propertyId: string) {
  await roomAccess(userId, sciId, propertyId);
  return db.propertyRoom.findMany({
    where: { sciId, propertyId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      roomType: true,
      floor: true,
      areaEstimate: true,
      notes: true,
      photos: {
        orderBy: { uploadedAt: 'asc' },
        select: {
          id: true,
          originalFilename: true,
          width: true,
          height: true,
          angleLabel: true,
          comment: true,
          uploadedAt: true,
          isCover: true,
        },
      },
    },
  });
}
export async function createRoom(userId: string, sciId: string, propertyId: string, raw: unknown) {
  await roomAccess(userId, sciId, propertyId, true);
  const input = roomSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId} AND "sciId" = ${sciId} FOR UPDATE`;
    if ((await tx.propertyRoom.count({ where: { sciId, propertyId } })) >= 30)
      throw new HttpError(409, 'Limite de 30 pièces par bien atteinte.');
    const room = await tx.propertyRoom.create({ data: { ...input, sciId, propertyId } });
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        entityId: propertyId,
        action: 'ROOM_CREATED',
        metadata: { roomId: room.id },
      },
    });
    return room.id;
  });
}
export async function addRoomPhoto(
  userId: string,
  sciId: string,
  propertyId: string,
  roomId: string,
  input: Buffer,
  filename: string,
  raw: unknown,
) {
  await roomAccess(userId, sciId, propertyId, true);
  if (!(await db.propertyRoom.findFirst({ where: { id: roomId, sciId, propertyId } })))
    throw new HttpError(404, 'Pièce introuvable.');
  const meta = photoMetadataSchema.parse(raw);
  let normalized;
  try {
    normalized = await normalizePhoto(input);
  } catch {
    throw new HttpError(
      400,
      'Photo invalide : JPEG, PNG ou WebP non animé, 8 Mo et 40 mégapixels maximum.',
    );
  }
  const media = await storeMedia(
    { image: normalized.image, thumbnail: normalized.thumbnail },
    `${sciId}/${propertyId}`,
  );
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId} AND "sciId" = ${sciId} FOR UPDATE`;
      if ((await tx.roomPhoto.count({ where: { sciId, propertyId } })) >= 100)
        throw new HttpError(409, 'Limite de 100 photos par bien atteinte.');
      const photo = await tx.roomPhoto.create({
        data: {
          ...normalized,
          image: media.image.bytes,
          thumbnail: media.thumbnail.bytes,
          imagePath: media.image.path,
          thumbnailPath: media.thumbnail.path,
          ...meta,
          sciId,
          propertyId,
          roomId,
          uploadedBy: userId,
          originalFilename: filename.replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(0, 180) || 'photo',
          isCover: (await tx.roomPhoto.count({ where: { sciId, propertyId, roomId } })) === 0,
        },
        select: { id: true },
      });
      await tx.activityLog.create({
        data: {
          sciId,
          actorId: userId,
          entityId: propertyId,
          action: 'ROOM_PHOTO_ADDED',
          metadata: { photoId: photo.id, roomId },
        },
      });
      return photo.id;
    });
  } catch (error) {
    await removeMedia(Object.values(media).flatMap((part) => (part.path ? [part.path] : [])));
    throw error;
  }
}

export async function updateRoomPhoto(
  userId: string,
  sciId: string,
  propertyId: string,
  photoId: string,
  raw: unknown,
) {
  await roomAccess(userId, sciId, propertyId, true);
  const input = photoUpdateSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId} AND "sciId" = ${sciId} FOR UPDATE`;
    const photo = await tx.roomPhoto.findFirst({
      where: { id: photoId, sciId, propertyId },
      select: { roomId: true, angleLabel: true, comment: true, isCover: true },
    });
    if (!photo) throw new HttpError(404, 'Photo introuvable.');
    if (
      Object.entries(input.expected).some(
        ([key, value]) => photo[key as keyof typeof photo] !== value,
      )
    )
      throw new HttpError(
        409,
        'Cette photo a été modifiée. Rechargez la galerie avant de réessayer.',
      );
    if (
      !(await tx.propertyRoom.findFirst({
        where: { id: input.roomId, sciId, propertyId },
        select: { id: true },
      }))
    )
      throw new HttpError(404, 'Pièce introuvable.');
    const moved = photo.roomId !== input.roomId;
    if (
      moved &&
      (await tx.roomDesignProject.findFirst({
        where: { sciId, propertyId, photoId },
        select: { id: true },
      }))
    )
      throw new HttpError(
        409,
        'Cette photo sert de source à un projet visuel. Ajoutez une copie dans la pièce souhaitée.',
      );
    const isCover =
      input.makeCover ||
      (!moved && photo.isCover) ||
      (moved &&
        (await tx.roomPhoto.count({ where: { sciId, propertyId, roomId: input.roomId } })) === 0);
    if (isCover)
      await tx.roomPhoto.updateMany({
        where: { sciId, propertyId, roomId: input.roomId, isCover: true },
        data: { isCover: false },
      });
    await tx.roomPhoto.update({
      where: { id: photoId },
      data: { roomId: input.roomId, angleLabel: input.angleLabel, comment: input.comment, isCover },
    });
    if (moved && photo.isCover) {
      const replacement = await tx.roomPhoto.findFirst({
        where: { sciId, propertyId, roomId: photo.roomId },
        orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (replacement)
        await tx.roomPhoto.update({ where: { id: replacement.id }, data: { isCover: true } });
    }
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        entityId: propertyId,
        action: 'ROOM_PHOTO_UPDATED',
        metadata: { photoId, fromRoomId: photo.roomId, roomId: input.roomId, isCover },
      },
    });
    return { ok: true };
  });
}
