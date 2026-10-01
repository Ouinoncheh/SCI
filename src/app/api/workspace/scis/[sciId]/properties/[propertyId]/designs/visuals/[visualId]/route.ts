import { checkOrigin, errorResponse, jsonBody, requireUser, HttpError } from '@/server/security';
import { z } from 'zod';
import { db } from '@/server/db';
import { readMedia } from '@/server/object-storage';
import { roomAccess } from '@/server/rooms';
import { favoriteDesign } from '@/server/designs';
type Context = { params: Promise<{ sciId: string; propertyId: string; visualId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireUser(request.headers);
    const { sciId, propertyId, visualId } = await params;
    await roomAccess(user.id, sciId, propertyId);
    const visual = await db.generatedVisual.findFirst({
      where: { id: visualId, sciId, propertyId, status: 'SUCCEEDED', project: { archived: false } },
      select: { image: true, thumbnail: true, imagePath: true, thumbnailPath: true },
    });
    const image = new URL(request.url).searchParams.has('thumbnail')
      ? visual?.thumbnail
      : visual?.image;
    if (!visual) throw new HttpError(404, 'Image indisponible.');
    const path = new URL(request.url).searchParams.has('thumbnail')
      ? visual.thumbnailPath
      : visual.imagePath;
    return new Response(new Uint8Array(await readMedia(image, path)), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    z.object({ favorite: z.literal(true) })
      .strict()
      .parse(await jsonBody(request));
    const { sciId, propertyId, visualId } = await params;
    await favoriteDesign(user.id, sciId, propertyId, visualId);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
