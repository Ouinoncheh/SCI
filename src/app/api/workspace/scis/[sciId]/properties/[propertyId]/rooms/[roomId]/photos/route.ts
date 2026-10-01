import { checkOrigin, errorResponse, HttpError, rateLimit, requireUser } from '@/server/security';
import { addRoomPhoto, roomAccess } from '@/server/rooms';
import { MAX_PHOTO_BYTES } from '@/visualization/images';
type Context = { params: Promise<{ sciId: string; propertyId: string; roomId: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    const { sciId, propertyId, roomId } = await params;
    await roomAccess(user.id, sciId, propertyId, true);
    await rateLimit(`photo-upload:${user.id}`, 20);
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
      throw new HttpError(415, 'Formulaire photo requis.');
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Photo manquante.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_PHOTO_BYTES + 16384) {
        await reader.cancel();
        throw new HttpError(413, 'Photo limitée à 8 Mo.');
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { 'Content-Type': request.headers.get('content-type')! },
    }).formData();
    const photo = form.get('photo');
    if (!(photo instanceof File)) throw new HttpError(400, 'Photo manquante.');
    if (photo.size > MAX_PHOTO_BYTES) throw new HttpError(413, 'Photo limitée à 8 Mo.');
    const id = await addRoomPhoto(
      user.id,
      sciId,
      propertyId,
      roomId,
      Buffer.from(await photo.arrayBuffer()),
      photo.name,
      { angleLabel: form.get('angleLabel') ?? '', comment: form.get('comment') ?? '' },
    );
    return Response.json({ id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
