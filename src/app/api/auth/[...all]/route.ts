import { getAuth } from '@/server/auth';
import { errorResponse, HttpError, checkOrigin, jsonBody } from '@/server/security';
export const dynamic = 'force-dynamic';
async function handler(request: Request) {
  try {
    if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET)
      throw new HttpError(503, 'Configurez PostgreSQL et Better Auth pour ouvrir les comptes.');
    if (request.method !== 'GET') {
      checkOrigin(request);
      const body = await jsonBody(request);
      request = new Request(request.url, { method: request.method, headers: request.headers, body: JSON.stringify(body) });
    }
    return await getAuth().handler(request);
  } catch (error) {
    return errorResponse(error);
  }
}
export { handler as GET, handler as POST };
