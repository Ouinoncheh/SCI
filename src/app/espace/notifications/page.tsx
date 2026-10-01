'use client';
import { useState, useEffect } from 'react';
import { useDemo } from '@/ui/demo-context';
import { api } from '@/ui/http';
import { PageHeading } from '@/ui/shell';
import type { NotificationsData } from '@/collaboration/types';
export default function Notifications() {
  const { workspace } = useDemo();
  const endpoint = workspace?.sci ? `/api/workspace/scis/${workspace.sci.id}/notifications` : null;
  const [data, setData] = useState<NotificationsData | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (endpoint)
      api<NotificationsData>(endpoint)
        .then((d) => {
          if (active) setData(d);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [endpoint]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="RESTER INFORMÉ"
        title="Vos notifications"
        description="Les mentions qui vous concernent dans la SCI active."
        action={false}
      />
      <section className="panel">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!endpoint ? (
          <p>Créez ou rejoignez une SCI pour recevoir des notifications.</p>
        ) : (
          <>
            <div className="panel-heading">
              <h2>
                {data ? `${data.unread} non lue${data.unread > 1 ? 's' : ''}` : 'Chargement…'}
              </h2>
              <button
                className="button"
                disabled={busy}
                onClick={() => run(async () => setData(await api<NotificationsData>(endpoint)))}
              >
                Actualiser
              </button>
            </div>
            {data?.entries.map((n) => (
              <article className={`notification ${n.readAt ? '' : 'unread'}`} key={n.id}>
                <div>
                  <p>{n.body}</p>
                  <time>
                    {new Date(n.createdAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
                  </time>
                </div>
                {!n.readAt && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api(`${endpoint}/${n.id}`, 'PATCH', { read: true });
                        setData(await api<NotificationsData>(endpoint));
                      })
                    }
                  >
                    Marquer comme lue
                  </button>
                )}
              </article>
            ))}
            {data && !data.entries.length && <p>Aucune notification pour le moment.</p>}
            {data?.nextCursor && (
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const older = await api<NotificationsData>(
                      `${endpoint}?cursor=${encodeURIComponent(data.nextCursor!)}`,
                    );
                    setData({ ...older, entries: [...data.entries, ...older.entries] });
                  })
                }
              >
                Notifications précédentes
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
