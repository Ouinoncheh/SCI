import { errorResponse, requireUser, HttpError } from '@/server/security';
import { draftAccess } from '@/server/import-drafts';
import { db } from '@/server/db';
import { readMedia } from '@/server/object-storage';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sciId: string; draftId: string; assetId: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { sciId, draftId, assetId } = await params;
    await draftAccess(user.id, sciId, draftId);
    const asset = await db.importAsset.findFirst({ where: { id: assetId, sciId, draftId } });
    if (!asset) throw new HttpError(404, 'Fichier introuvable.');
    const size = new URL(request.url).searchParams.get('size');
    const data =
      size === 'thumbnail' ? asset.thumbnail : size === 'medium' ? asset.medium : asset.original;
    const path =
      size === 'thumbnail'
        ? asset.thumbnailPath
        : size === 'medium'
          ? asset.mediumPath
          : asset.originalPath;
    return new Response(new Uint8Array(await readMedia(data, path)), {
      headers: {
        'Content-Type': asset.kind === 'document' ? 'application/octet-stream' : 'image/webp',
        'Content-Disposition':
          asset.kind === 'document'
            ? 'attachment; filename="document"'
            : 'inline; filename="photo.webp"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
