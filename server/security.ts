import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from './db';
import { getAuth } from './auth';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function checkOrigin(request: Request) {
  const expected = process.env.BETTER_AUTH_URL;
  if (!expected || request.headers.get('origin') !== new URL(expected).origin)
    throw new HttpError(403, 'Origine de la requête refusée.');
}
export async function jsonBody(request: Request, maximum = 65536): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'JSON requis.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Corps manquant.');
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maximum) {
      await reader.cancel();
      throw new HttpError(413, 'Requête trop volumineuse.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'JSON invalide.');
  }
}
export async function requireUser(headers: Headers) {
  const session = await getAuth().api.getSession({ headers });
  if (!session) throw new HttpError(401, 'Connexion requise.');
  if (!session.user.emailVerified) throw new HttpError(403, 'Vérifiez votre adresse email.');
  return session.user;
}
export async function membership(
  userId: string,
  sciId: string,
  permission: 'read' | 'write' | 'admin' = 'read',
) {
  const member = await db.sCIMember.findUnique({ where: { sciId_userId: { sciId, userId } } });
  if (!member) throw new HttpError(404, 'SCI introuvable.');
  if (
    (permission === 'admin' && member.role !== 'ADMIN') ||
    (permission === 'write' && member.role === 'VIEWER')
  )
    throw new HttpError(403, 'Votre rôle ne permet pas cette action.');
  return member;
}
/** Atomic DB-backed fixed window, shared across application instances. No IP from untrusted headers. */
export async function rateLimit(key: string, maximum = 120, seconds = 60, now = new Date()) {
  const digest = createHash('sha256').update(key).digest('hex');
  const end = new Date(now.getTime() + seconds * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "ApiRateBucket" ("key", "count", "expiresAt") VALUES (${digest}, 1, ${end})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "ApiRateBucket"."expiresAt" <= ${now} THEN 1 ELSE "ApiRateBucket"."count" + 1 END,
      "expiresAt" = CASE WHEN "ApiRateBucket"."expiresAt" <= ${now} THEN ${end} ELSE "ApiRateBucket"."expiresAt" END
    RETURNING "count"`;
  if (rows[0].count > maximum)
    throw new HttpError(429, 'Trop de requêtes. Réessayez dans une minute.');
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return Response.json(
      { error: error.message },
      {
        status: error.status,
        headers: {
          'Cache-Control': 'no-store',
          ...(error.status === 429 ? { 'Retry-After': '60' } : {}),
        },
      },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: 'Données invalides.',
        fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  // Never send SQL, credentials, session tokens or raw provider exceptions to a client.
  console.error('PredictSCI request failed:', error instanceof Error ? error.name : 'UnknownError');
  return Response.json({ error: 'Une erreur est survenue. Réessayez plus tard.' }, { status: 500 });
}
