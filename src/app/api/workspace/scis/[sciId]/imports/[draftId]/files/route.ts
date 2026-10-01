import { checkOrigin, errorResponse, requireUser, rateLimit } from '@/server/security';
import { addImportFile } from '@/server/import-files';
export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sciId: string; draftId: string }> },
) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    await rateLimit(`import-files:${user.id}`, 10);
    const { sciId, draftId } = await params;
    return Response.json(await addImportFile(user.id, sciId, draftId, request), {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
