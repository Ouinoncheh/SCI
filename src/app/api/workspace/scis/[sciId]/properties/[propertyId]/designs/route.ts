import { checkOrigin, errorResponse, jsonBody, requireUser, rateLimit } from '@/server/security';
import { listDesigns, createDesign } from '@/server/designs';
type Context = { params: Promise<{ sciId: string; propertyId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireUser(request.headers);
    const { sciId, propertyId } = await params;
    return Response.json(await listDesigns(user.id, sciId, propertyId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    await rateLimit(`design:${user.id}`, 10);
    const { sciId, propertyId } = await params;
    return Response.json(
      { id: await createDesign(user.id, sciId, propertyId, await jsonBody(request)) },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
