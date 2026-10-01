import { z } from 'zod';
import { checkOrigin, errorResponse, jsonBody, requireUser, rateLimit } from '@/server/security';
import { archiveDesign } from '@/server/designs';
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sciId: string; propertyId: string; projectId: string }> },
) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    await rateLimit(`design:${user.id}`, 10);
    z.object({ archived: z.literal(true) })
      .strict()
      .parse(await jsonBody(request));
    const { sciId, propertyId, projectId } = await params;
    await archiveDesign(user.id, sciId, propertyId, projectId);
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
