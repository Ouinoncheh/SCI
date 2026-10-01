'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDemo } from './demo-context';
import { api } from './http';
import {
  designNotice,
  designSchema,
  designStyles,
  renovationLevels,
  promptLibrary,
  projectionPrompt,
  type DesignProject,
  type DesignInput,
} from '../visualization/design';
import type { GalleryRoom } from '../visualization/types';
import type { RenovationScenario } from '../renovation';
type Result = {
  projects: DesignProject[];
  configuration: { ready: boolean; model: string; provider: string; dailyLimit: number };
  usedToday: number;
};
const statusLabels = {
  PENDING: 'En attente',
  PROCESSING: 'Génération en cours',
  SUCCEEDED: 'Générée',
  FAILED: 'Échec',
};
function BeforeAfter({ before, after }: { before: string; after: string }) {
  const [position, setPosition] = useState(50);
  return (
    <div className="before-after">
      <div className="before-after-images">
        {/* eslint-disable-next-line @next/next/no-img-element -- Private images bypass shared optimizer. */}
        <img src={before} alt="Avant : photo réelle du bien" />
        <div className="after-image" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Private generated images bypass shared optimizer. */}
          <img src={after} alt="Après : visualisation IA indicative" />
        </div>
        <span className="before-label">Avant — photo réelle</span>
        <span className="after-label">Après — projection IA</span>
      </div>
      <label>
        Comparer avant / après
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
      </label>
      <p className="muted">
        Les perspectives et dimensions peuvent différer ; la superposition ne démontre aucune
        fidélité architecturale.
      </p>
    </div>
  );
}
export function DesignStudio({ propertyId }: { propertyId: string }) {
  const { workspace, canEdit } = useDemo();
  const base = workspace?.sci
    ? `/api/workspace/scis/${workspace.sci.id}/properties/${propertyId}`
    : null;
  const [result, setResult] = useState<Result>(),
    [rooms, setRooms] = useState<GalleryRoom[]>([]),
    [scenarios, setScenarios] = useState<RenovationScenario[]>([]);
  const [draft, setDraft] = useState<DesignInput>({
    name: 'Projection après travaux',
    photoId: '',
    scenarioId: null,
    style: 'Moderne',
    renovationLevel: 'Rafraîchissement',
    prompt: '',
  });
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(Boolean(base));
  const [variants, setVariants] = useState(1),
    [consent, setConsent] = useState(false),
    [selected, setSelected] = useState<Record<string, string>>({});
  const [requests] = useState(() => new Map<string, string>());
  useEffect(() => {
    let active = true;
    if (base)
      Promise.all([
        api<Result>(`${base}/designs`),
        api<GalleryRoom[]>(`${base}/rooms`),
        api<RenovationScenario[]>(`${base}/renovation`),
      ])
        .then(([data, rs, ss]) => {
          if (active) {
            setResult(data);
            setRooms(rs);
            setScenarios(ss);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [base]);
  const processing = result?.projects.some((p) =>
    p.visuals.some((v) => ['PENDING', 'PROCESSING'].includes(v.status)),
  );
  useEffect(() => {
    if (!base || !processing) return;
    let active = true;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      api<Result>(`${base}/designs`)
        .then((data) => {
          if (active) setResult(data);
        })
        .catch(() => {});
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [base, processing]);
  async function refresh() {
    if (base) setResult(await api<Result>(`${base}/designs`));
  }
  async function operation(run: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!base)
    return (
      <section className="panel">
        <h2>Projections après travaux</h2>
        <p>
          Créez un projet depuis vos photos dans l’espace connecté, puis associez-le à un scénario
          travaux.
        </p>
        <Link href="/espace" className="button">
          Ouvrir mon espace
        </Link>
        <p className="muted">Aucune visualisation IA n’est générée dans cette démonstration.</p>
      </section>
    );
  const photos = rooms.flatMap((room) =>
    room.photos.map((photo) => ({ ...photo, roomName: room.name, roomType: room.roomType })),
  );
  return (
    <section className="panel design-studio">
      <h2>Projections après travaux</h2>
      <p className="demo-notice">{designNotice} Rendu non contractuel.</p>
      {loading && <p>Chargement des projets…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {result && (
        <p>
          {result.configuration.ready
            ? `Fournisseur : ${result.configuration.provider} · modèle ${result.configuration.model}`
            : 'Génération IA non activée. Vous pouvez préparer et conserver vos projets ; la clé et le modèle doivent être configurés côté serveur.'}{' '}
          · {result.usedToday}/{result.configuration.dailyLimit} variantes demandées sur 24 heures
          pour votre SCI.
        </p>
      )}
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void operation(async () => {
              const valid = designSchema.safeParse(draft);
              if (!valid.success)
                throw new Error(
                  'Choisissez une photo, un nom et un prompt de 10 caractères minimum.',
                );
              await api(`${base}/designs`, 'POST', valid.data);
              await refresh();
              setMessage(
                'Projet conservé. Lancez la génération depuis sa carte lorsque le fournisseur sera activé.',
              );
            });
          }}
        >
          <h3>Créer une projection IA</h3>
          {!photos.length && (
            <p>
              Ajoutez d’abord une photo à une pièce dans la galerie ci-dessus. Rechargez les photos
              après l’ajout.
            </p>
          )}
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() =>
              void operation(async () => setRooms(await api<GalleryRoom[]>(`${base}/rooms`)))
            }
          >
            Actualiser les photos
          </button>
          <div className="form-grid">
            <label>
              Nom du projet
              <input
                maxLength={100}
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Photo source
              <select
                aria-label="Photo source"
                required
                value={draft.photoId}
                onChange={(e) => setDraft({ ...draft, photoId: e.target.value })}
              >
                <option value="">Choisir une photo</option>
                {photos.map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {photo.roomName} — {photo.angleLabel || photo.originalFilename}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Style
              <select
                aria-label="Style de projection"
                value={draft.style}
                onChange={(e) =>
                  setDraft({ ...draft, style: e.target.value as DesignInput['style'] })
                }
              >
                {designStyles.map((style) => (
                  <option key={style}>{style}</option>
                ))}
              </select>
            </label>
            <label>
              Niveau de rénovation
              <select
                aria-label="Niveau de rénovation"
                value={draft.renovationLevel}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    renovationLevel: e.target.value as DesignInput['renovationLevel'],
                  })
                }
              >
                {renovationLevels.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
            <label>
              Scénario travaux associé
              <select
                aria-label="Scénario travaux associé"
                value={draft.scenarioId ?? ''}
                onChange={(e) => setDraft({ ...draft, scenarioId: e.target.value || null })}
              >
                <option value="">Aucun scénario associé</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {draft.photoId && (
            <div className="source-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- Private source file. */}
              <img
                src={`${base}/photos/${draft.photoId}`}
                alt="Photo réelle sélectionnée pour la projection"
              />
            </div>
          )}
          <label>
            Votre projet de rénovation
            <textarea
              rows={4}
              minLength={10}
              maxLength={3000}
              required
              value={draft.prompt}
              onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
              placeholder="Décrivez les couleurs, revêtements, mobilier et ambiance souhaités…"
            />
          </label>
          <div className="budget-actions">
            {Object.keys(promptLibrary).map((room) => (
              <button
                type="button"
                key={room}
                className="button"
                onClick={() => setDraft({ ...draft, prompt: promptLibrary[room] })}
              >
                Prompt {room.toLocaleLowerCase()}
              </button>
            ))}
          </div>
          <button
            className="button primary"
            type="submit"
            disabled={busy || loading || !draft.photoId}
          >
            Enregistrer le projet visuel
          </button>
        </form>
      )}
      {canEdit && !!result?.projects.length && (
        <div className="generation-options">
          <label>
            Nombre de variantes
            <select
              aria-label="Nombre de variantes"
              value={variants}
              onChange={(e) => setVariants(Number(e.target.value))}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            J’autorise l’envoi de la photo et du prompt à OpenAI pour une génération susceptible
            d’être facturée.
          </label>
        </div>
      )}
      {result?.projects.map((project) => {
        const succeeded = project.visuals.filter((v) => v.status === 'SUCCEEDED');
        const visual =
          succeeded.find((v) => v.id === selected[project.id]) ??
          succeeded.find((v) => v.favorite) ??
          succeeded[0];
        return (
          <article className="design-project" key={project.id}>
            <h3>{project.name}</h3>
            <p>
              {project.style} · {project.renovationLevel} ·{' '}
              {new Date(project.createdAt).toLocaleDateString('fr-FR')}
            </p>
            <p>
              Budget associé :{' '}
              {scenarios.find((s) => s.id === project.scenarioId)?.name ??
                (project.scenarioId ? 'Scénario archivé ou indisponible' : 'Aucun')}
              . La visualisation ne modifie pas ce budget.
            </p>
            <p>{project.prompt}</p>
            <details>
              <summary>Prompt complet envoyé au fournisseur</summary>
              <p>{projectionPrompt(project)}</p>
            </details>
            <p className="muted">Visualisation IA indicative, non contractuelle.</p>
            {project.visuals.map((v) => (
              <p key={v.id}>
                {v.variationLabel} · {statusLabels[v.status]} · {v.modelName}
                {v.favorite ? ' · Préférée' : ''}
                {v.errorMessage ? ` · ${v.errorMessage}` : ''}
                {v.completedAt ? ` · ${new Date(v.completedAt).toLocaleString('fr-FR')}` : ''}
              </p>
            ))}
            {!!succeeded.length && (
              <>
                <div className="design-variants">
                  {succeeded.map((v) => (
                    <button
                      key={v.id}
                      className="button"
                      aria-pressed={visual?.id === v.id}
                      onClick={() => setSelected({ ...selected, [project.id]: v.id })}
                    >
                      {v.variationLabel}
                      {v.favorite ? ' · Préférée' : ''}
                    </button>
                  ))}
                </div>
                {visual && (
                  <>
                    <BeforeAfter
                      before={`${base}/photos/${project.photoId}`}
                      after={`${base}/designs/visuals/${visual.id}`}
                    />
                    <a
                      href={`${base}/designs/visuals/${visual.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ouvrir la projection indicative
                    </a>
                    {canEdit && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          void operation(async () => {
                            await api(`${base}/designs/visuals/${visual.id}`, 'PATCH', {
                              favorite: true,
                            });
                            await refresh();
                          })
                        }
                      >
                        Choisir cette variante comme préférée
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            {canEdit && (
              <div className="budget-actions">
                <button
                  className="button"
                  onClick={() => {
                    setDraft({
                      name: `${project.name.slice(0, 88)} copie`,
                      photoId: project.photoId,
                      scenarioId: project.scenarioId,
                      style: project.style,
                      renovationLevel: project.renovationLevel,
                      prompt: project.prompt,
                    });
                    setMessage(
                      'Copie chargée dans le formulaire : adaptez le prompt et enregistrez un nouveau projet.',
                    );
                  }}
                >
                  Dupliquer le projet
                </button>
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    !consent ||
                    !result.configuration.ready ||
                    project.visuals.some((v) => ['PENDING', 'PROCESSING'].includes(v.status))
                  }
                  onClick={() =>
                    void operation(async () => {
                      let key = requests.get(project.id);
                      if (!key) {
                        key = crypto.randomUUID();
                        requests.set(project.id, key);
                      }
                      await api(`${base}/designs/${project.id}/generate`, 'POST', {
                        requestKey: key,
                        variants,
                        consent: true,
                      });
                      await refresh();
                      requests.delete(project.id);
                      setConsent(false);
                      setMessage(
                        'Demande enregistrée. Le traitement continue en arrière-plan ; aucune relance automatique en cas d’échec.',
                      );
                    })
                  }
                >
                  {project.visuals.length
                    ? 'Générer de nouvelles variantes'
                    : 'Générer la projection'}
                </button>
                <button
                  className="button"
                  disabled={
                    busy ||
                    project.visuals.some((v) => ['PENDING', 'PROCESSING'].includes(v.status))
                  }
                  onClick={() =>
                    void operation(async () => {
                      await api(`${base}/designs/${project.id}`, 'PATCH', { archived: true });
                      await refresh();
                      setMessage('Projet archivé.');
                    })
                  }
                >
                  Archiver le projet
                </button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
