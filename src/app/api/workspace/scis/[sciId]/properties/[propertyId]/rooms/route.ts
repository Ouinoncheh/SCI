import { checkOrigin, errorResponse, jsonBody, rateLimit, requireUser } from '@/server/security';
import { createRoom, listRooms } from '@/server/rooms';
type Context = { params: Promise<{ sciId: string; propertyId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireUser(request.headers);
    const { sciId, propertyId } = await params;
    return Response.json(await listRooms(user.id, sciId, propertyId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    await rateLimit(`rooms:${user.id}`, 30);
    const { sciId, propertyId } = await params;
    return Response.json(
      { id: await createRoom(user.id, sciId, propertyId, await jsonBody(request)) },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
