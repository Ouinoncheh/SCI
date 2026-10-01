import { errorResponse, requireUser } from '@/server/security';
import { recentDrafts } from '@/server/import-drafts';
export async function GET(request: Request, { params }: { params: Promise<{ sciId: string }> }) {
  try {
    const user = await requireUser(request.headers);
    return Response.json(await recentDrafts(user.id, (await params).sciId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
