'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from './http';
import { useDemo } from './demo-context';
import {
  publicHttps,
  type ImportedListing,
  type ListingAttachment,
} from '../listing-providers/import-types';
import {
  emptyValues,
  fieldLabels,
  PropertyNormalizer,
  propertyValuesSchema,
  type PropertyValues,
} from '../listing-providers/normalized';
import { normalizeListingText } from '../listing-providers/text';
import type { DraftDto } from '../server/import-drafts';
type Asset = { id: string; kind: string; originalFilename: string };
type Draft = DraftDto & { assets?: Asset[] };
const numbers = new Set([
  'price',
  'surface',
  'rooms',
  'bedrooms',
  'latitude',
  'longitude',
  'floor',
  'totalFloors',
  'condominiumFees',
  'propertyTax',
  'agencyFees',
]);
const flags = new Set(['elevator', 'balcony', 'terrace', 'garden', 'parking', 'garage', 'cellar']);
export function ListingImport({
  onApply,
}: {
  onApply: (data: ImportedListing, listing: ListingAttachment) => void;
}) {
  const { workspace, canEdit } = useDemo();
  const base = workspace?.sci ? `/api/workspace/scis/${workspace.sci.id}` : null;
  const [url, setUrl] = useState(''),
    [html, setHtml] = useState<string>();
  const [draft, setDraft] = useState<Draft>(),
    [values, setValues] = useState<PropertyValues>(emptyValues());
  const [text, setText] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<{ id: string; sourceUrl: string; status: string }[]>([]),
    [file, setFile] = useState<File>(),
    [kind, setKind] = useState('document');
  useEffect(() => {
    let active = true;
    if (base)
      api<typeof recent>(`${base}/imports`)
        .then((data) => {
          if (active) setRecent(data);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [base]);
  function receive(data: Draft) {
    setDraft(data);
    setUrl(data.sourceUrl);
    const clean = Object.fromEntries(
      Object.entries(data.normalized).filter(([key]) => key in propertyValuesSchema.shape),
    );
    setValues(propertyValuesSchema.parse(clean));
    setMessage(
      data.message ??
        (data.status === 'NEEDS_IMPORT_DATA'
          ? 'Complétez les informations manquantes.'
          : 'Informations extraites : vérifiez chaque champ.'),
    );
  }
  async function operation(run: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function analyze(input?: { text?: string; corrected?: PropertyValues }) {
    if (base) {
      const data = await api<Draft>(`${base}/listing-import`, 'POST', {
        url,
        html: input ? undefined : html,
        ...input,
        draftId: draft?.id,
        version: draft?.version,
      });
      receive(await api<Draft>(`${base}/imports/${data.id}`));
      setMessage(data.message ?? 'Informations à vérifier.');
    } else {
      const normalized = input?.corrected
        ? new PropertyNormalizer().normalize(url, input.corrected, 'USER_CONFIRMED', 1)
        : input?.text
          ? normalizeListingText(input.text, url)
          : new PropertyNormalizer().normalize(url, emptyValues(), 'UNAVAILABLE', 0);
      receive({
        id: 'temporary',
        sourceUrl: url,
        status: 'NEEDS_IMPORT_DATA',
        version: 1,
        normalized,
        enrichment: {
          geocoding: null,
          market: null,
          marketSource: null,
          dpeCandidates: [],
          warnings: [],
        },
        message:
          'Cette plateforme ne permet pas l’import automatique depuis notre serveur. Ajoutez le contenu de l’annonce pour continuer.',
      });
    }
  }
  return (
    <section className="panel listing-import">
      <h2>Importer une annonce par son lien</h2>
      <p>Commencez avec une URL. Si la source refuse la lecture, complétez l’annonce ici.</p>
      {!base && (
        <p className="demo-notice">
          Brouillon temporaire de démonstration.{' '}
          <Link href="/espace/biens/nouveau">
            Connectez-vous pour conserver les brouillons et importer vos fichiers.
          </Link>
        </p>
      )}
      {!!recent.length && (
        <label>
          Reprendre un brouillon
          <select
            aria-label="Reprendre un brouillon"
            value=""
            disabled={busy}
            onChange={(e) =>
              void operation(async () =>
                receive(await api<Draft>(`${base}/imports/${e.target.value}`)),
              )
            }
          >
            <option value="">Choisir un import commencé</option>
            {recent.map((r) => (
              <option key={r.id} value={r.id}>
                {r.sourceUrl}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        URL de l’annonce
        <input
          type="url"
          maxLength={2048}
          value={url}
          disabled={busy}
          placeholder="https://…"
          onChange={(e) => {
            setUrl(e.target.value);
            setDraft(undefined);
            setHtml(undefined);
            setText('');
            setError('');
            setMessage('');
          }}
        />
      </label>
      <label>
        Fichier HTML de l’annonce (facultatif, 2 Mo maximum)
        <input
          type="file"
          accept=".html,.htm,text/html"
          disabled={busy || !base}
          onChange={async (e) => {
            const selected = e.target.files?.[0];
            setHtml(undefined);
            if (!selected) return;
            if (selected.size > 2_000_000) {
              setError('Fichier limité à 2 Mo.');
              return;
            }
            setHtml(await selected.text());
          }}
        />
      </label>
      <button
        className="button primary"
        disabled={busy || !canEdit || !publicHttps(url)}
        onClick={() => void operation(() => analyze())}
      >
        {busy ? 'Lecture de l’annonce…' : 'Analyser l’annonce'}
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p className="demo-notice">{message}</p>}
      {draft && (
        <div>
          <h3>
            {draft.status === 'NEEDS_IMPORT_DATA'
              ? 'Compléter l’annonce'
              : 'Aperçu — à vérifier avant utilisation'}
          </h3>
          <p>
            Lien conservé :{' '}
            <a href={draft.sourceUrl} target="_blank" rel="noopener noreferrer">
              ouvrir l’annonce originale
            </a>
            .
          </p>
          <label>
            Contenu de l’annonce
            <textarea
              rows={6}
              maxLength={20000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Collez les caractéristiques, la description et le prix…"
            />
          </label>
          <button
            className="button"
            disabled={busy || !text.trim() || !canEdit}
            onClick={() => void operation(() => analyze({ text }))}
          >
            Extraire les informations du texte
          </button>
          {base && (
            <div>
              <h4>Documents, captures et photos</h4>
              <div className="form-grid">
                <label>
                  Type de contenu
                  <select
                    aria-label="Type de contenu"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="document">Document PDF, DOCX ou TXT</option>
                    <option value="screenshot">Capture d’écran à lire</option>
                    <option value="photo">Photo du bien à conserver</option>
                  </select>
                </label>
                <label>
                  Fichier fourni
                  <input
                    type="file"
                    accept={
                      kind === 'document' ? '.pdf,.docx,.txt' : 'image/jpeg,image/png,image/webp'
                    }
                    onChange={(e) => setFile(e.target.files?.[0])}
                  />
                </label>
              </div>
              <p className="muted">
                8 Mo maximum. Les captures sont lues automatiquement quand l’OCR est disponible. Les
                photos servent à la galerie et ne créent aucune estimation de travaux.
              </p>
              <button
                className="button"
                disabled={!file || busy || !canEdit}
                onClick={() =>
                  void operation(async () => {
                    if (!file) return;
                    const body = new FormData();
                    body.set('file', file);
                    body.set('kind', kind);
                    const response = await fetch(`${base}/imports/${draft.id}/files`, {
                      method: 'POST',
                      body,
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error ?? 'Envoi impossible.');
                    receive(data.draft);
                    if (data.text) setText(data.text);
                    setMessage(data.warning ?? 'Fichier ajouté. Vérifiez les données détectées.');
                    setFile(undefined);
                  })
                }
              >
                Ajouter le fichier
              </button>
            </div>
          )}
          <h4>Informations détectées et corrections</h4>
          <div className="form-grid import-fields">
            {(Object.keys(fieldLabels) as (keyof PropertyValues)[])
              .filter((key) => !['images', 'description'].includes(key))
              .map((key) => (
                <label key={key}>
                  {fieldLabels[key]}
                  {flags.has(key) ? (
                    <select
                      aria-label={fieldLabels[key]}
                      value={values[key] === null ? '' : String(values[key])}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [key]: e.target.value === '' ? null : e.target.value === 'true',
                        }))
                      }
                    >
                      <option value="">Donnée indisponible</option>
                      <option value="true">Oui</option>
                      <option value="false">Non</option>
                    </select>
                  ) : key === 'propertyType' ? (
                    <select
                      aria-label="Type de bien"
                      value={values.propertyType ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          propertyType: (e.target.value || null) as PropertyValues['propertyType'],
                        }))
                      }
                    >
                      <option value="">Donnée indisponible</option>
                      {Object.entries({
                        HOUSE: 'Maison',
                        APARTMENT: 'Appartement',
                        LAND: 'Terrain',
                        COMMERCIAL: 'Local commercial',
                        OTHER: 'Autre',
                      }).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={fieldLabels[key]}
                      type={numbers.has(key) ? 'number' : 'text'}
                      step="any"
                      value={values[key] === null ? '' : String(values[key])}
                      placeholder="Donnée indisponible"
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [key]:
                            e.target.value === ''
                              ? null
                              : numbers.has(key)
                                ? Number(e.target.value)
                                : e.target.value,
                        }))
                      }
                    />
                  )}
                  <details className="field-provenance">
                    <summary>D’où vient cette donnée ?</summary>
                    {draft.normalized.confidence[key] ? (
                      <span>
                        {draft.normalized.confidence[key]!.source} · confiance{' '}
                        {Math.round(draft.normalized.confidence[key]!.confidence * 100)} % ·{' '}
                        {new Date(draft.normalized.confidence[key]!.retrievedAt).toLocaleDateString(
                          'fr-FR',
                        )}
                        <br />
                        <a
                          href={draft.normalized.confidence[key]!.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Consulter la source
                        </a>
                        <br />
                        Les valeurs modifiées seront enregistrées comme données confirmées par vous.
                      </span>
                    ) : (
                      <span>Aucune donnée détectée.</span>
                    )}
                  </details>
                </label>
              ))}
          </div>
          <label>
            Description détectée
            <textarea
              rows={5}
              maxLength={20000}
              value={values.description ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value || null }))}
            />
          </label>
          <p className="muted">
            Les charges de copropriété représentent le montant annuel annoncé, pas nécessairement la
            part non récupérable utilisée dans les calculs.
          </p>
          {base && (
            <div>
              {draft.assets
                ?.filter((asset) => asset.kind === 'document')
                .map((asset) => (
                  <p key={asset.id}>
                    <a href={`${base}/imports/${draft.id}/files/${asset.id}`}>
                      {asset.originalFilename}
                    </a>
                  </p>
                ))}
            </div>
          )}
          {base && (
            <div className="listing-photos">
              {draft.assets
                ?.filter((asset) => asset.kind !== 'document')
                .map((asset) => (
                  <figure key={asset.id}>
                    <a
                      href={`${base}/imports/${draft.id}/files/${asset.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- Private uploaded files with no shared optimizer cache. */}
                      <img
                        src={`${base}/imports/${draft.id}/files/${asset.id}?size=thumbnail`}
                        alt={
                          asset.kind === 'screenshot' ? 'Capture fournie' : 'Photo du bien fournie'
                        }
                        loading="lazy"
                      />
                    </a>
                    <figcaption>
                      {asset.originalFilename} · {asset.kind === 'screenshot' ? 'Capture' : 'Photo'}
                    </figcaption>
                  </figure>
                ))}
            </div>
          )}
          <div className="panel enrichment-summary">
            <h4>Enrichissement public</h4>
            <p>
              {values.price !== null && values.surface !== null
                ? `Bien : ${(values.price / values.surface).toFixed(0)} €/m²`
                : 'Prix au m² : donnée indisponible.'}
            </p>
            {draft.enrichment.market && values.price !== null && values.surface !== null && (
              <p>
                Écart à la médiane DVF :{' '}
                {(
                  (values.price / values.surface / draft.enrichment.market.median - 1) *
                  100
                ).toFixed(1)}{' '}
                %
              </p>
            )}
            {draft.enrichment.geocoding && (
              <p>
                <a
                  href={draft.enrichment.geocoding.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Source BAN
                </a>{' '}
                · {draft.enrichment.geocoding.retrievedAt}
              </p>
            )}
            {draft.enrichment.marketSource && (
              <p>
                <a
                  href={draft.enrichment.marketSource.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Source DVF
                </a>{' '}
                · {draft.enrichment.marketSource.retrievedAt}
              </p>
            )}
            <p>
              {draft.enrichment.geocoding
                ? `BAN : ${draft.enrichment.geocoding.label} · ${draft.enrichment.geocoding.inseeCode}`
                : 'Adresse BAN précise : donnée indisponible.'}
            </p>
            <p>
              {draft.enrichment.market
                ? `DVF : ${draft.enrichment.market.count} comparables · médiane ${draft.enrichment.market.median.toFixed(0)} €/m² · moyenne ${draft.enrichment.market.mean.toFixed(0)} €/m² · dispersion ${draft.enrichment.market.dispersion.toFixed(0)} €/m²`
                : 'Transactions DVF comparables : donnée indisponible.'}
            </p>
            <p>
              {draft.enrichment.dpeCandidates.length
                ? `${draft.enrichment.dpeCandidates.length} DPE candidat(s) : validation utilisateur requise.`
                : 'DPE ADEME fiable : donnée indisponible.'}
            </p>
            {draft.enrichment.dpeCandidates.map((candidate, i) => (
              <p key={i}>
                DPE {candidate.dpe} · {candidate.surface} m² · {candidate.date} ·{' '}
                <a href={candidate.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Source ADEME
                </a>
              </p>
            ))}
            {draft.enrichment.warnings.map((warning) => (
              <p className="muted" key={warning}>
                {warning}
              </p>
            ))}
          </div>
          <button
            className="button primary"
            disabled={busy || !canEdit}
            onClick={() =>
              void operation(async () => {
                const valid = propertyValuesSchema.safeParse(values);
                if (!valid.success)
                  throw new Error(
                    'Vérifiez les champs corrigés (DPE/GES A à G, code postal à 5 chiffres, nombres valides).',
                  );
                await analyze({ corrected: valid.data });
                onApply(
                  {
                    sourceUrl: url,
                    title: values.title,
                    description: values.description ?? '',
                    price: values.price,
                    area: values.surface,
                    city: values.city,
                    postcode: values.postalCode,
                    address: values.address,
                    rooms: values.rooms,
                    dpe: values.dpe,
                    photos: [],
                    warnings: [],
                  },
                  {
                    sourceUrl: url,
                    method: 'text',
                    photos: [],
                    photoRights: true,
                    draftId: base ? draft.id : undefined,
                    normalized: valid.data,
                  },
                );
              })
            }
          >
            Utiliser ces informations sans photos distantes
          </button>
        </div>
      )}
    </section>
  );
}
