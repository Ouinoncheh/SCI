'use client';
import { useEffect, useState } from 'react';
import { analyze, type Investment } from '../financial-engine';
import {
  compareRenovation,
  roomBudgets,
  emptyRenovation,
  renovationSchema,
  workCategories,
  type RenovationInput,
  type RenovationScenario,
  type WorkItem,
} from '../renovation';
import { useDemo } from './demo-context';
import { api } from './http';
import { euro, pct } from './format';
import type { DemoProperty } from '../data/demo';
import { WorkSpendingEditor, SpendingSummary } from './work-spending';
type Room = { id: string; name: string };
const clean = (v: RenovationScenario): RenovationInput => ({
  name: v.name,
  description: v.description,
  monthlyRent: v.monthlyRent,
  contingencyRate: v.contingencyRate,
  budgetMode: v.budgetMode,
  items: v.items,
});
export function RenovationBudget({
  property,
  onApply,
}: {
  property: DemoProperty;
  onApply: (investment: Investment) => void;
}) {
  const { workspace, canEdit, saveInvestment, busy: workspaceBusy } = useDemo();
  const base = workspace?.sci
    ? `/api/workspace/scis/${workspace.sci.id}/properties/${property.id}`
    : null;
  const [scenarios, setScenarios] = useState<RenovationScenario[]>([]),
    [rooms, setRooms] = useState<Room[]>([]);
  const [draft, setDraft] = useState<RenovationInput>(emptyRenovation),
    [editing, setEditing] = useState<{ id: string; version: number }>();
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(Boolean(base)),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    if (base) {
      Promise.all([api<RenovationScenario[]>(`${base}/renovation`), api<Room[]>(`${base}/rooms`)])
        .then(([rows, rs]) => {
          if (active) {
            setScenarios(rows);
            setRooms(rs);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [base]);
  async function refresh() {
    if (base) setScenarios(await api<RenovationScenario[]>(`${base}/renovation`));
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
  function itemChange(id: string, change: Partial<WorkItem>) {
    setDraft((v) => ({ ...v, items: v.items.map((r) => (r.id === id ? { ...r, ...change } : r)) }));
  }
  const preview = compareRenovation(property.investment, draft),
    reference = analyze(property.investment);
  async function save() {
    const valid = renovationSchema.safeParse(draft);
    if (!valid.success)
      throw new Error(
        'Vérifiez les postes et les paiements (libellé, date et montant TTC). Les montants sont limités à deux décimales.',
      );
    if (base) {
      await api(
        editing ? `${base}/renovation/${editing.id}` : `${base}/renovation`,
        editing ? 'PATCH' : 'POST',
        editing ? { version: editing.version, data: valid.data } : valid.data,
      );
      await refresh();
    } else {
      setScenarios((rows) =>
        editing
          ? rows.map((r) =>
              r.id === editing.id
                ? {
                    ...r,
                    ...valid.data,
                    version: r.version + 1,
                    updatedAt: new Date().toISOString(),
                  }
                : r,
            )
          : [
              ...rows,
              {
                ...valid.data,
                id: crypto.randomUUID(),
                version: 1,
                favorite: false,
                updatedAt: new Date().toISOString(),
              },
            ],
      );
    }
    setDraft(emptyRenovation());
    setEditing(undefined);
    setMessage('Scénario enregistré. L’analyse principale reste disponible comme référence.');
  }
  return (
    <div className="renovation-budget">
      <section className="panel">
        <h2>Budget travaux et scénarios</h2>
        <p>
          Comparez vos projets sur le même prix d’achat, apport et financement. Les loyers sont des
          hypothèses saisies, sans hausse automatique liée aux travaux.
        </p>
        <p className="muted">
          Montants TTC indicatifs, à confirmer par devis. La provision pour imprévus s’applique aux
          travaux hors ameublement. Une donnée vide reste inconnue.
        </p>
        {!base && (
          <p className="demo-notice">
            Scénarios temporaires de démonstration : ils disparaissent en quittant cet onglet.
            Connectez-vous pour les conserver.
          </p>
        )}
        {loading && <p>Chargement des scénarios…</p>}
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        {canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void operation(save);
            }}
          >
            <h3>{editing ? 'Modifier le scénario' : 'Créer un scénario travaux'}</h3>
            <div className="form-grid">
              <label>
                Nom du scénario
                <input
                  maxLength={100}
                  value={draft.name}
                  required
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Loyer mensuel envisagé (€)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={`Référence : ${property.investment.monthlyRent} €`}
                  value={draft.monthlyRent ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      monthlyRent: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Imprévus travaux (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={draft.contingencyRate}
                  onChange={(e) => setDraft({ ...draft, contingencyRate: Number(e.target.value) })}
                />
              </label>
              <label>
                Budget retenu
                <select
                  value={draft.budgetMode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      budgetMode: e.target.value as RenovationInput['budgetMode'],
                    })
                  }
                >
                  <option value="LOW">Fourchette basse</option>
                  <option value="CENTRAL">Milieu de fourchette</option>
                  <option value="HIGH">Fourchette haute</option>
                </select>
              </label>
            </div>
            <label>
              Description du scénario
              <textarea
                rows={2}
                maxLength={2000}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <p>
              Laissez le loyer vide pour reprendre le loyer de l’analyse principale. Les postes
              ci-dessous remplacent les montants travaux et ameublement de cette analyse.
            </p>
            {draft.items.map((item, i) => (
              <fieldset className="work-item" key={item.id}>
                <legend>Poste {i + 1}</legend>
                <div className="form-grid">
                  <label>
                    Pièce
                    <select
                      value={item.roomId ?? ''}
                      onChange={(e) => itemChange(item.id, { roomId: e.target.value || null })}
                    >
                      <option value="">Travaux généraux</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Catégorie
                    <select
                      value={item.category}
                      onChange={(e) =>
                        itemChange(item.id, { category: e.target.value as WorkItem['category'] })
                      }
                    >
                      {Object.entries(workCategories).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Libellé
                    <input
                      required
                      maxLength={150}
                      value={item.label}
                      onChange={(e) => itemChange(item.id, { label: e.target.value })}
                    />
                  </label>
                  <label>
                    Quantité
                    <input
                      type="number"
                      min={0.001}
                      max={100000}
                      step="any"
                      value={item.quantity}
                      onChange={(e) => itemChange(item.id, { quantity: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Unité
                    <select
                      aria-label="Unité"
                      value={item.unit}
                      onChange={(e) =>
                        itemChange(item.id, { unit: e.target.value as WorkItem['unit'] })
                      }
                    >
                      {['forfait', 'm²', 'unité'].map((unit) => (
                        <option key={unit}>{unit}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prix unitaire minimum TTC (€)
                    <input
                      type="number"
                      min={0}
                      max={1e8}
                      step="0.01"
                      value={item.unitMin ?? ''}
                      placeholder="À compléter"
                      onChange={(e) =>
                        itemChange(item.id, {
                          unitMin: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Prix unitaire maximum TTC (€)
                    <input
                      type="number"
                      min={0}
                      max={1e8}
                      step="0.01"
                      value={item.unitMax ?? ''}
                      placeholder="À compléter"
                      onChange={(e) =>
                        itemChange(item.id, {
                          unitMax: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Origine du montant
                    <select
                      value={item.source}
                      onChange={(e) =>
                        itemChange(item.id, { source: e.target.value as WorkItem['source'] })
                      }
                    >
                      <option value="USER_ESTIMATE">Mon estimation</option>
                      <option value="QUOTE">Devis fourni</option>
                    </select>
                  </label>
                </div>
                <label>
                  Référence du devis ou notes
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={item.notes}
                    onChange={(e) => itemChange(item.id, { notes: e.target.value })}
                  />
                </label>
                <p>
                  {preview.budget.items[i]?.min === null || preview.budget.items[i]?.max === null
                    ? 'Total du poste : à compléter'
                    : `Total TTC : ${euro(preview.budget.items[i].min!)} à ${euro(preview.budget.items[i].max!)}`}
                </p>
                <WorkSpendingEditor item={item} change={(patch) => itemChange(item.id, patch)} />
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    setDraft((v) => ({ ...v, items: v.items.filter((r) => r.id !== item.id) }))
                  }
                >
                  Retirer ce poste
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              className="button"
              disabled={busy || draft.items.length >= 100}
              onClick={() =>
                setDraft((v) => ({
                  ...v,
                  items: [
                    ...v.items,
                    {
                      id: crypto.randomUUID(),
                      roomId: null,
                      category: 'PAINT',
                      label: '',
                      quantity: 1,
                      unit: 'forfait',
                      unitMin: null,
                      unitMax: null,
                      source: 'USER_ESTIMATE',
                      notes: '',
                    },
                  ],
                }))
              }
            >
              Ajouter un poste travaux
            </button>
            <div className="budget-preview" aria-live="polite">
              <h4>Budget du scénario</h4>
              <SpendingSummary input={draft} investment={property.investment} />
              <div>
                <h4>Sous-totaux par pièce, hors imprévus</h4>
                {roomBudgets(draft).map((r) => (
                  <p key={r.roomId ?? 'general'}>
                    {rooms.find((room) => room.id === r.roomId)?.name ?? 'Travaux généraux'} :{' '}
                    {r.min === null || r.max === null
                      ? 'À compléter'
                      : `${euro(r.min)} à ${euro(r.max)}`}{' '}
                    · {r.count} poste(s)
                  </p>
                ))}
              </div>
              {preview.budget.complete ? (
                <>
                  <p>
                    Fourchette TTC avec imprévus :{' '}
                    <strong>
                      {euro(preview.budget.range.LOW.total)} à{' '}
                      {euro(preview.budget.range.HIGH.total)}
                    </strong>
                  </p>
                  <p>
                    Budget retenu : {euro(preview.budget.range[draft.budgetMode].total)} · dont
                    ameublement {euro(preview.budget.range[draft.budgetMode].furniture)}
                  </p>
                  {preview.financial && (
                    <p>
                      Cash-flow avant impôt : {euro(preview.financial.cashFlowMonthly)}/mois ·
                      rendement net {pct(preview.financial.netYield)}
                    </p>
                  )}
                </>
              ) : (
                <p>Budget incomplet : renseignez les fourchettes de tous les postes.</p>
              )}
              {preview.error && preview.budget.complete && <p>{preview.error}</p>}
            </div>
            <div className="budget-actions">
              <button
                type="submit"
                className="button primary"
                disabled={busy || loading || !draft.items.length}
              >
                {editing ? 'Enregistrer les modifications' : 'Enregistrer le scénario'}
              </button>
              {editing && (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setEditing(undefined);
                    setDraft(emptyRenovation());
                  }}
                >
                  Annuler la modification
                </button>
              )}
            </div>
          </form>
        )}
      </section>
      <section className="panel">
        <h2>Comparer la rentabilité</h2>
        <p>
          Même base financière enregistrée pour tous les scénarios. Rentabilité et cash-flow avant
          impôt ; aucune valorisation future n’est déduite des travaux.
        </p>
        <div className="budget-table-wrap">
          <table className="budget-table">
            <caption>Analyse principale et scénarios travaux</caption>
            <thead>
              <tr>
                <th>Scénario</th>
                <th>Travaux + ameublement + imprévus</th>
                <th>Loyer / mois</th>
                <th>Coût total</th>
                <th>Mensualité</th>
                <th>Rendement brut</th>
                <th>Rendement net</th>
                <th>Cash-flow / mois</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Analyse principale</th>
                <td>
                  {euro(
                    property.investment.works * (1 + property.investment.contingencyRate / 100) +
                      property.investment.furniture,
                  )}
                </td>
                <td>{euro(property.investment.monthlyRent)}</td>
                <td>{euro(reference.totalCost)}</td>
                <td>{euro(reference.loan.monthlyTotal)}</td>
                <td>{pct(reference.grossYield)}</td>
                <td>{pct(reference.netYield)}</td>
                <td>{euro(reference.cashFlowMonthly)}</td>
              </tr>
              {scenarios.map((s) => {
                const result = compareRenovation(property.investment, s);
                return (
                  <tr key={s.id}>
                    <th>
                      {s.name}
                      {s.favorite ? ' · Préféré' : ''}
                    </th>
                    <td>
                      {result.budget.complete
                        ? euro(result.budget.range[s.budgetMode].total)
                        : 'À compléter'}
                    </td>
                    <td>{euro(s.monthlyRent ?? property.investment.monthlyRent)}</td>
                    <td>{result.financial ? euro(result.financial.totalCost) : 'Indisponible'}</td>
                    <td>
                      {result.financial ? euro(result.financial.loan.monthlyTotal) : 'Indisponible'}
                    </td>
                    <td>{result.financial ? pct(result.financial.grossYield) : 'Indisponible'}</td>
                    <td>{result.financial ? pct(result.financial.netYield) : 'Indisponible'}</td>
                    <td>
                      {result.financial ? euro(result.financial.cashFlowMonthly) : 'Indisponible'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!scenarios.length && (
          <p>Aucun scénario enregistré. Ajoutez vos postes pour comparer un premier projet.</p>
        )}
        {scenarios.map((s) => {
          const result = compareRenovation(property.investment, s);
          return (
            <article className="saved-budget" key={s.id}>
              <h3>
                {s.name}
                {s.favorite ? ' · Préféré' : ''}
              </h3>
              {s.description && <p>{s.description}</p>}
              <SpendingSummary input={s} investment={property.investment} />
              <p>
                {s.budgetMode === 'LOW'
                  ? 'Budget bas'
                  : s.budgetMode === 'HIGH'
                    ? 'Budget haut'
                    : 'Milieu de fourchette'}{' '}
                · provision {s.contingencyRate} % · enregistré le{' '}
                {new Date(s.updatedAt).toLocaleDateString('fr-FR')}
              </p>
              <details>
                <summary>Voir les postes et leurs sources</summary>
                {s.items.map((item) => (
                  <p key={item.id}>
                    <strong>
                      {rooms.find((r) => r.id === item.roomId)?.name ?? 'Travaux généraux'} ·{' '}
                      {item.label}
                    </strong>{' '}
                    : {item.quantity} {item.unit} ×{' '}
                    {item.unitMin === null ? '?' : euro(item.unitMin)} à{' '}
                    {item.unitMax === null ? '?' : euro(item.unitMax)} ·{' '}
                    {item.source === 'QUOTE' ? 'Devis fourni' : 'Estimation personnelle'}
                    {item.notes ? ` · ${item.notes}` : ''}
                    {item.contractor ? ` · ${item.contractor}` : ''}
                    {item.quoteReference ? ` · Devis ${item.quoteReference}` : ''}
                    {item.quoteStatus
                      ? ` · ${{ REQUESTED: 'Demandé', RECEIVED: 'Reçu', ACCEPTED: 'Accepté', DECLINED: 'Refusé' }[item.quoteStatus]}`
                      : ''}
                    {(item.expenses ?? []).map((expense) => (
                      <span key={expense.id} style={{ display: 'block' }}>
                        {expense.date} · {expense.label} · {euro(expense.amount)}
                        {expense.reference ? ` · ${expense.reference}` : ''}
                      </span>
                    ))}
                  </p>
                ))}
              </details>
              {result.error && <p>{result.error}</p>}
              {canEdit && (
                <div className="budget-actions">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => {
                      setDraft(clean(s));
                      setEditing({ id: s.id, version: s.version });
                      setMessage('Scénario chargé dans le formulaire ci-dessus.');
                    }}
                  >
                    Modifier
                  </button>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => {
                      setDraft({
                        ...clean(s),
                        name: `${s.name.slice(0, 90)} copie`,
                        items: s.items.map((r) => ({
                          ...r,
                          id: crypto.randomUUID(),
                          expenses: [],
                          actualFinal: false,
                        })),
                      });
                      setEditing(undefined);
                      setMessage(
                        'Copie prête à enregistrer. Les paiements et les soldes ne sont pas recopiés.',
                      );
                    }}
                  >
                    Dupliquer
                  </button>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void operation(async () => {
                        if (base) {
                          await api(`${base}/renovation/${s.id}`, 'PATCH', {
                            version: s.version,
                            favorite: !s.favorite,
                          });
                          await refresh();
                        } else
                          setScenarios((rows) =>
                            rows.map((r) => ({
                              ...r,
                              favorite: r.id === s.id ? !s.favorite : false,
                            })),
                          );
                      })
                    }
                  >
                    {s.favorite ? 'Retirer le favori' : 'Choisir comme préféré'}
                  </button>
                  <button
                    className="button primary"
                    disabled={busy || workspaceBusy || !result.investment}
                    onClick={() =>
                      void operation(async () => {
                        if (
                          result.investment &&
                          (await saveInvestment(property.id, result.investment))
                        ) {
                          onApply(result.investment);
                          setMessage(
                            'Hypothèses du scénario appliquées à l’analyse principale et enregistrées.',
                          );
                        } else
                          throw new Error(
                            'Enregistrement refusé. Vérifiez le message de l’espace puis rechargez le bien.',
                          );
                      })
                    }
                  >
                    Appliquer à l’analyse principale
                  </button>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void operation(async () => {
                        if (base) {
                          await api(`${base}/renovation/${s.id}`, 'PATCH', {
                            version: s.version,
                            archived: true,
                          });
                          await refresh();
                        } else setScenarios((rows) => rows.filter((r) => r.id !== s.id));
                        if (editing?.id === s.id) {
                          setEditing(undefined);
                          setDraft(emptyRenovation());
                        }
                        setMessage('Scénario archivé.');
                      })
                    }
                  >
                    Archiver
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
