import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser, HttpError } from './security';
import { listScis, sciDetails } from './workspace';
import { listProperties } from './properties';
export async function loadWorkspace() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) redirect('/connexion');
  let user;
  try {
    user = await requireUser(await headers());
  } catch (e) {
    if (e instanceof HttpError && [401, 403].includes(e.status)) redirect('/connexion');
    throw e;
  }
  const memberships = await listScis(user.id);
  const requested = (await cookies()).get('predict-sci')?.value;
  const current = memberships.find((m) => m.sci.id === requested) ?? memberships[0];
  const sci = current ? await sciDetails(user.id, current.sci.id) : null;
  return {
    user: { id: user.id, name: user.name, email: user.email },
    scis: memberships.map((m) => ({ id: m.sci.id, name: m.sci.name, role: m.role })),
    sci: sci
      ? {
          ...sci,
          activities: sci.activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
        }
      : null,
    role: current?.role ?? null,
    items: current ? await listProperties(user.id, current.sci.id) : [],
  };
}
