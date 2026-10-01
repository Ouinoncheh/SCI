import { checkOrigin, errorResponse, jsonBody, requireUser, rateLimit } from '@/server/security';
import { listRenovationScenarios, saveRenovationScenario } from '@/server/renovation';
type Context = { params: Promise<{ sciId: string; propertyId: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireUser(request.headers);
    const { sciId, propertyId } = await params;
    return Response.json(await listRenovationScenarios(user.id, sciId, propertyId), {
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
    await rateLimit(`renovation:${user.id}`, 20);
    const { sciId, propertyId } = await params;
    return Response.json(
      {
        id: await saveRenovationScenario(
          user.id,
          sciId,
          propertyId,
          await jsonBody(request, 200000),
        ),
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
