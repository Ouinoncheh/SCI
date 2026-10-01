import {
  checkOrigin,
  jsonBody,
  rateLimit,
  errorResponse,
  HttpError,
  requireUser,
} from '@/server/security';
import { roomAccess, updateRoomPhoto } from '@/server/rooms';
import { db } from '@/server/db';
import { readMedia } from '@/server/object-storage';
type Context = { params: Promise<{ sciId: string; propertyId: string; photoId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    await rateLimit(`photo-edit:${user.id}`, 30);
    const { sciId, propertyId, photoId } = await params;
    return Response.json(
      await updateRoomPhoto(user.id, sciId, propertyId, photoId, await jsonBody(request)),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireUser(request.headers);
    const { sciId, propertyId, photoId } = await params;
    await roomAccess(user.id, sciId, propertyId);
    const thumbnail = new URL(request.url).searchParams.get('thumbnail') === '1';
    const row = await db.roomPhoto.findFirst({
      where: { id: photoId, sciId, propertyId },
      select: { thumbnail: true, image: true, imagePath: true, thumbnailPath: true },
    });
    if (!row) throw new HttpError(404, 'Photo introuvable.');
    return new Response(
      new Uint8Array(
        await readMedia(
          thumbnail ? row.thumbnail : row.image,
          thumbnail ? row.thumbnailPath : row.imagePath,
        ),
      ),
      {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition': 'inline; filename="photo.webp"',
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
