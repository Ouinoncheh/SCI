import { checkOrigin, errorResponse, jsonBody, requireUser, rateLimit } from '@/server/security';
import { queueDesign } from '@/server/designs';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sciId: string; propertyId: string; projectId: string }> },
) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    await rateLimit(`design-generate:${user.id}`, 5);
    const { sciId, propertyId, projectId } = await params;
    return Response.json(
      { ids: await queueDesign(user.id, sciId, propertyId, projectId, await jsonBody(request)) },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
