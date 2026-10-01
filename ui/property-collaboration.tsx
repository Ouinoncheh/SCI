'use client';
import { useEffect, useState } from 'react';
import { api } from './http';
import { useDemo } from './demo-context';
import { euro, pct, number } from './format';
import { fieldGroups } from './investment-fields';
import {
  voteLabels,
  type VoteChoice,
  type CollaborationData,
  type AnalysisHistory,
} from '@/collaboration/types';
const date = (v: string) => new Date(v).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
const activityLabels: Record<string, string> = {
  PROPERTY_CREATED: 'Bien ajouté',
  ANALYSIS_SAVED: 'Analyse enregistrée',
  STATUS_CHANGED: 'Statut modifié',
  PROPERTY_UPDATED: 'Caractéristiques modifiées',
  ROOM_CREATED: 'Pièce ajoutée',
  ROOM_PHOTO_ADDED: 'Photo de pièce ajoutée',
  COMMENT_ADDED: 'Commentaire ajouté',
  VOTE_CHANGED: 'Vote enregistré',
  VOTE_REMOVED: 'Vote retiré',
};

export function PropertyCollaboration({ propertyId }: { propertyId: string }) {
  const { workspace, canEdit } = useDemo();
  const endpoint = workspace?.sci
    ? `/api/workspace/scis/${workspace.sci.id}/properties/${propertyId}`
    : null;
  const [data, setData] = useState<CollaborationData | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState(''),
    [mentions, setMentions] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    if (endpoint)
      api<CollaborationData>(`${endpoint}/collaboration`)
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
  if (!endpoint)
    return (
      <section className="panel">
        <h2>Échangez en famille</h2>
        <p>
          Les commentaires et les votes sont disponibles sur les biens de votre espace connecté.
        </p>
      </section>
    );
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setData(await api<CollaborationData>(`${endpoint}/collaboration`));
  }
  const myVote = data?.votes.find((v) => v.memberId === data.currentMemberId)?.choice;
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>L’avis de la famille</h2>
            <p>Un avis par membre. Les votes ne changent ni les calculs ni le score.</p>
          </div>
          <button className="button" disabled={busy} onClick={() => run(refresh)}>
            Actualiser les échanges
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!data && !error && <p role="status">Chargement des échanges…</p>}
        {data && (
          <>
            <div className="vote-options">
              {(Object.entries(voteLabels) as [VoteChoice, string][]).map(([choice, label]) => (
                <button
                  key={choice}
                  className={`button ${myVote === choice ? 'primary' : ''}`}
                  disabled={!canEdit || busy}
                  aria-pressed={myVote === choice}
                  onClick={() =>
                    run(async () => {
                      await api(`${endpoint}/vote`, 'PUT', { choice });
                      await refresh();
                    })
                  }
                >
                  {label} · {data.votes.filter((v) => v.choice === choice).length}
                </button>
              ))}
              {myVote && (
                <button
                  className="button"
                  disabled={!canEdit || busy}
                  onClick={() =>
                    run(async () => {
                      await api(`${endpoint}/vote`, 'PUT', { choice: null });
                      await refresh();
                    })
                  }
                >
                  Retirer mon vote
                </button>
              )}
            </div>
            <ul className="vote-list">
              {data.votes.map((v) => (
                <li key={v.memberId}>
                  {v.name} : {voteLabels[v.choice]}
                </li>
              ))}
            </ul>
            {!data.votes.length && <p>Aucun vote pour le moment.</p>}
            {!canEdit && (
              <p className="muted">Votre rôle lecteur permet de consulter les échanges.</p>
            )}
          </>
        )}
      </section>
      {data && (
        <div className="two-columns">
          <section className="panel">
            <h2>Commentaires</h2>
            {canEdit && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api(`${endpoint}/comments`, 'POST', {
                      body,
                      mentionedMemberIds: mentions,
                    });
                    setBody('');
                    setMentions([]);
                    await refresh();
                  });
                }}
              >
                <label>
                  Votre commentaire
                  <textarea
                    rows={4}
                    maxLength={4000}
                    required
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
                <fieldset className="mention-picker">
                  <legend>Mentionner des membres (facultatif)</legend>
                  {data.members
                    .filter((m) => m.id !== data.currentMemberId)
                    .map((m) => (
                      <label className="checkbox" key={m.id}>
                        <input
                          type="checkbox"
                          checked={mentions.includes(m.id)}
                          onChange={(e) =>
                            setMentions(
                              e.target.checked
                                ? [...mentions, m.id]
                                : mentions.filter((id) => id !== m.id),
                            )
                          }
                        />
                        {m.name}
                      </label>
                    ))}
                  {data.members.length === 1 && (
                    <p className="micro">Invitez d’autres membres depuis SCI & membres.</p>
                  )}
                </fieldset>
                <button className="button primary" disabled={busy || !body.trim()}>
                  Publier le commentaire
                </button>
              </form>
            )}
            <div className="comment-list">
              {data.comments.map((c) => (
                <article key={c.id} className="comment">
                  <header>
                    <strong>{c.author}</strong>
                    <time>{date(c.createdAt)}</time>
                  </header>
                  <p>{c.body}</p>
                  {Boolean(c.mentions.length) && (
                    <small>Membres mentionnés : {c.mentions.join(', ')}</small>
                  )}
                </article>
              ))}
              {!data.comments.length && <p>Aucun commentaire pour le moment.</p>}
            </div>
            {data.nextCursor && (
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const older = await api<CollaborationData>(
                      `${endpoint}/collaboration?cursor=${encodeURIComponent(data.nextCursor!)}`,
                    );
                    setData({ ...older, comments: [...data.comments, ...older.comments] });
                  })
                }
              >
                Commentaires précédents
              </button>
            )}
          </section>
          <section className="panel">
            <h2>Historique des décisions</h2>
            <p className="micro">Les 30 dernières opérations sur ce bien.</p>
            <ul className="activity-list">
              {data.activities.map((a) => (
                <li key={a.id}>
                  <span>
                    <strong>{activityLabels[a.action] ?? a.action}</strong>
                    <small className="activity-author">{a.actor ?? 'Auteur indisponible'}</small>
                  </span>
                  <time>{date(a.createdAt)}</time>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}

export function PropertyHistory({ propertyId }: { propertyId: string }) {
  const { workspace } = useDemo();
  const endpoint = workspace?.sci
    ? `/api/workspace/scis/${workspace.sci.id}/properties/${propertyId}/history`
    : null;
  const [data, setData] = useState<AnalysisHistory | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (endpoint)
      api<AnalysisHistory>(endpoint)
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
  if (!endpoint)
    return (
      <section className="panel">
        <h2>Historique des analyses</h2>
        <p>Les versions sont conservées dans l’espace connecté lors de chaque enregistrement.</p>
      </section>
    );
  async function load(older = false) {
    setBusy(true);
    setError('');
    try {
      const result = await api<AnalysisHistory>(
        endpoint! +
          (older && data?.nextCursor ? `?cursor=${encodeURIComponent(data.nextCursor)}` : ''),
      );
      setData(
        older && data ? { ...result, entries: [...data.entries, ...result.entries] } : result,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Les analyses enregistrées</h2>
          <p>
            Résultats conservés à la date de calcul, avant fiscalité. La consultation ne modifie pas
            l’analyse actuelle.
          </p>
        </div>
        <button className="button" disabled={busy} onClick={() => load()}>
          Actualiser l’historique
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Chargement de l’historique…</p>}
      {data?.entries.map((entry) => (
        <details className="analysis-snapshot" key={entry.id}>
          <summary>
            <span>
              {date(entry.createdAt)} · moteur {entry.engineVersion}
            </span>
            <span>
              {entry.metrics
                ? `${euro(entry.metrics.cashFlowMonthly)}/mois`
                : 'Résultat indisponible'}
            </span>
          </summary>
          {entry.metrics && (
            <div className="mini-stats">
              <div>
                <small>Coût total</small>
                <strong>{euro(entry.metrics.totalCost)}</strong>
              </div>
              <div>
                <small>Rendement net</small>
                <strong>{pct(entry.metrics.netYield)}</strong>
              </div>
              <div>
                <small>Cash-flow mensuel</small>
                <strong>{euro(entry.metrics.cashFlowMonthly)}</strong>
              </div>
            </div>
          )}
          {entry.inputs ? (
            <dl className="data-list">
              {fieldGroups
                .flatMap((g) => g.fields)
                .map(([key, label, unit]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>
                      {number(entry.inputs![key])} {unit}
                    </dd>
                  </div>
                ))}
            </dl>
          ) : (
            <p>Données d’entrée indisponibles ou incompatibles avec le format actuel.</p>
          )}
        </details>
      ))}
      {data && !data.entries.length && <p>Aucune analyse enregistrée.</p>}
      {data?.nextCursor && (
        <button className="button" disabled={busy} onClick={() => load(true)}>
          Analyses précédentes
        </button>
      )}
    </section>
  );
}
