import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  checkOrigin,
  errorResponse,
  HttpError,
  jsonBody,
  rateLimit,
  requireUser,
  membership,
} from '@/server/security';
import {
  listScis,
  createSci,
  sciDetails,
  createInvitation,
  acceptInvitation,
} from '@/server/workspace';
import { createProperty, deleteProperty, listProperties, setFavorite, updateProperty } from '@/server/properties';
import {
  getCollaboration,
  addComment,
  setVote,
  analysisHistory,
  notifications,
  markRead,
} from '@/server/collaboration';
import { cursorSchema } from '@/collaboration/validation';
type Context = { params: Promise<{ path: string[] }> };
export const dynamic = 'force-dynamic';
async function handler(request: Request, context: Context) {
  try {
    if (request.method !== 'GET') checkOrigin(request);
    const user = await requireUser(request.headers);
    await rateLimit(`workspace:${user.id}`);
    const { path } = await context.params;
    const [resource, sciId, child, id, action] = path;
    const result = (body: unknown, status = 200) =>
      Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    if (resource === 'scis' && path.length === 1) {
      if (request.method === 'GET') return result(await listScis(user.id));
      if (request.method === 'POST')
        return result({ id: await createSci(user.id, await jsonBody(request)) }, 201);
    }
    if (resource === 'active-sci' && path.length === 1 && request.method === 'POST') {
      const input = z
        .object({ sciId: z.string().min(1).max(100) })
        .strict()
        .parse(await jsonBody(request));
      await membership(user.id, input.sciId);
      (await cookies()).set('predict-sci', input.sciId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.BETTER_AUTH_URL?.startsWith('https://'),
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
      return result({ ok: true });
    }
    if (
      resource === 'invitations' &&
      sciId === 'accept' &&
      path.length === 2 &&
      request.method === 'POST'
    ) {
      const { token } = z
        .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
        .strict()
        .parse(await jsonBody(request));
      return result({ sciId: await acceptInvitation(user.id, user.email, token) });
    }
    if (resource !== 'scis' || !sciId) throw new HttpError(404, 'Ressource introuvable.');
    if (child === 'notifications' && path.length === 3 && request.method === 'GET')
      return result(
        await notifications(
          user.id,
          sciId,
          cursorSchema.parse(new URL(request.url).searchParams.get('cursor')),
        ),
      );
    if (child === 'notifications' && id && path.length === 4 && request.method === 'PATCH') {
      z.object({ read: z.literal(true) })
        .strict()
        .parse(await jsonBody(request));
      await markRead(user.id, sciId, id);
      return result({ ok: true });
    }
    if (child === 'properties' && id && path.length === 5) {
      if (action === 'collaboration' && request.method === 'GET')
        return result(
          await getCollaboration(
            user.id,
            sciId,
            id,
            cursorSchema.parse(new URL(request.url).searchParams.get('cursor')),
          ),
        );
      if (action === 'history' && request.method === 'GET')
        return result(
          await analysisHistory(
            user.id,
            sciId,
            id,
            cursorSchema.parse(new URL(request.url).searchParams.get('cursor')),
          ),
        );
      if (action === 'comments' && request.method === 'POST') {
        await rateLimit(`comments:${user.id}`, 20);
        return result({ id: await addComment(user.id, sciId, id, await jsonBody(request)) }, 201);
      }
      if (action === 'vote' && request.method === 'PUT') {
        await setVote(user.id, sciId, id, await jsonBody(request));
        return result({ ok: true });
      }
    }
    if (path.length === 2 && request.method === 'GET')
      return result(await sciDetails(user.id, sciId));
    if (child === 'invitations' && path.length === 3 && request.method === 'POST')
      return result({ url: await createInvitation(user.id, sciId, await jsonBody(request)) }, 201);
    if (child === 'properties' && path.length === 3) {
      if (request.method === 'GET') return result(await listProperties(user.id, sciId));
      if (request.method === 'POST')
        return result({ id: await createProperty(user.id, sciId, await jsonBody(request)) }, 201);
    }
    if (child === 'properties' && id && path.length === 4 && request.method === 'PATCH') {
      await updateProperty(user.id, sciId, id, await jsonBody(request));
      return result({ ok: true });
    }
    if (child === 'properties' && id && path.length === 4 && request.method === 'DELETE') {
      await deleteProperty(user.id, sciId, id, await jsonBody(request));
      return result({ ok: true });
    }
    if (
      child === 'properties' &&
      id &&
      action === 'favorite' &&
      path.length === 5 &&
      request.method === 'PUT'
    ) {
      const { favorite } = z
        .object({ favorite: z.boolean() })
        .strict()
        .parse(await jsonBody(request));
      await setFavorite(user.id, sciId, id, favorite);
      return result({ ok: true });
    }
    throw new HttpError(404, 'Ressource introuvable.');
  } catch (error) {
    return errorResponse(error);
  }
}
export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
