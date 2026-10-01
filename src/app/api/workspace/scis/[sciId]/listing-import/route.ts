import {
  checkOrigin,
  errorResponse,
  jsonBody,
  rateLimit,
  requireUser,
} from '@/server/security';
import { importDraft } from '@/server/import-drafts';
import { logImport } from '@/server/import-log';
type Context = { params: Promise<{ sciId: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    await rateLimit(`listing-import:${user.id}`, 10);
    const { sciId } = await params;
    const draft = await importDraft(user.id, sciId, await jsonBody(request, 2_100_000));
    logImport({
      url: draft.sourceUrl,
      provider: draft.source,
      method: 'POST',
      status: 200,
      allow: 'POST',
      contentType: 'application/json',
      stage: 'next_api_completed',
    });
    return Response.json(draft, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    logImport({
      url: request.url,
      provider: 'next-api',
      method: 'POST',
      status: errorResponse(error).status,
      allow: 'POST',
      contentType: 'application/json',
      stage: 'next_api_validation_or_access',
    });
    return errorResponse(error);
  }
}
export async function GET(request: Request) {
  logImport({
    url: request.url,
    provider: 'next-api',
    method: 'GET',
    status: 405,
    allow: 'POST',
    contentType: 'application/json',
    stage: 'next_api_wrong_method',
  });
  return Response.json(
    { error: 'Utilisez le bouton Analyser pour démarrer l’import.' },
    { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } },
  );
}
