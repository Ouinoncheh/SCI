import { checkOrigin, errorResponse, jsonBody, requireUser, rateLimit } from '@/server/security';
import { saveRenovationScenario } from '@/server/renovation';
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sciId: string; propertyId: string; scenarioId: string }> },
) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    await rateLimit(`renovation:${user.id}`, 20);
    const { sciId, propertyId, scenarioId } = await params;
    await saveRenovationScenario(
      user.id,
      sciId,
      propertyId,
      await jsonBody(request, 200000),
      scenarioId,
    );
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
