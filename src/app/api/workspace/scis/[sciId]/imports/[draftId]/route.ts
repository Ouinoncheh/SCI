import { errorResponse, requireUser } from '@/server/security';
import { draftAccess } from '@/server/import-drafts';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sciId: string; draftId: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { sciId, draftId } = await params;
    return Response.json(await draftAccess(user.id, sciId, draftId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
