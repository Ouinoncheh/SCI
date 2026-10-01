'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleAlert, Download, Info, RotateCcw } from 'lucide-react';
import {
  analyze,
  investmentSchema,
  negotiate,
  project,
  scenarioSchema,
  stressTests,
  type Investment,
} from '@/financial-engine';
import { scenarioFixtures, statusLabels, type DemoProperty } from '@/data/demo';
import { opportunityScore } from '@/opportunity-engine';
import { useDemo } from './demo-context';
import { euro, number, pct } from './format';
import { PropertyPhoto } from './property-photo';
import { CashFlowChart, ProjectionChart } from './charts';
import { InvestmentFields } from './investment-fields';
import { PropertyCollaboration, PropertyHistory } from './property-collaboration';
import { PropertyEditor } from './property-editor';
import { RoomGallery } from './room-gallery';
import { ImportSources } from './import-sources';
import { RenovationBudget } from './renovation-budget';
import { DesignStudio } from './design-studio';
const tabs = [
  'Vue d’ensemble',
  'Hypothèses',
  'Crédit',
  'Projection',
  'Risques',
  'Fiscalité & marché',
  'Échanges',
  'Historique',
  'Caractéristiques',
  'Visualisation',
  'Travaux & scénarios',
];
export function PropertyDetail({ id }: { id: string }) {
  const { items, basePath, persistent } = useDemo();
  const p = items.find((x) => x.id === id);
  return p ? (
    <Detail key={p.id} p={p} />
  ) : (
    <div className="empty">
      <h1>Bien introuvable</h1>
      <p>
        {persistent
          ? 'Ce bien n’existe pas dans votre SCI actuelle.'
          : 'Les ajouts de démonstration sont effacés lors d’un rechargement.'}
      </p>
      <Link href={`${basePath}/biens`}>Revenir aux biens</Link>
    </div>
  );
}
function Detail({ p }: { p: DemoProperty }) {
  const { setStatus, basePath, persistent, canEdit, busy, saveInvestment } = useDemo();
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Investment>(p.investment),
    [v, setV] = useState<Investment>(p.investment),
    [tab, setTab] = useState(tabs[0]);
  const [scenarioIndex, setScenarioIndex] = useState(1),
    [scenario, setScenario] = useState(scenarioFixtures[1]),
    [target, setTarget] = useState(0);
  const valid = investmentSchema.safeParse(draft),
    scenarioValid = scenarioSchema.safeParse(scenario);
  const a = analyze(v),
    score = opportunityScore(v, p.dpe),
    activeScenario = scenarioValid.success ? scenarioValid.data : scenarioFixtures[scenarioIndex];
  const projection = project(v, activeScenario),
    stress = stressTests(v, activeScenario);
  const maxPrice = Number.isFinite(target) ? negotiate(v, target) : null;
  const modified = JSON.stringify(v) !== JSON.stringify(p.investment);
  function exportLoan() {
    const header =
      'Mois;Echeance hors assurance;Interets;Capital rembourse;Assurance;Capital restant du';
    const rows = a.loan.schedule.map((r) =>
      [r.month, r.payment, r.interest, r.principal, r.insurance, r.balance]
        .map((n) => n.toFixed(2).replace('.', ','))
        .join(';'),
    );
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + [header, ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `echeancier-${p.id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <Link className="back" href={`${basePath}/biens`}>
        <ArrowLeft size={15} />
        Tous les biens
      </Link>
      <div className="detail-heading">
        <div>
          <div className="eyebrow">
            {p.city.toUpperCase()} · {p.district.toUpperCase()} ·{' '}
            {persistent ? 'BIEN À L’ÉTUDE' : 'BIEN FICTIF'}
          </div>
          <h1>{p.title}</h1>
          <p>
            {p.rooms ? `${p.rooms} pièces` : 'Nombre de pièces indisponible'} · {number(v.area)} m²
            · DPE {p.dpe === '?' ? 'indisponible' : p.dpe} · {p.postcode}
          </p>
        </div>
        <label className="status-select">
          Statut de l’étude
          <select
            aria-label="Statut du bien"
            disabled={!canEdit || busy}
            value={p.status}
            onChange={(e) => setStatus(p.id, e.target.value)}
          >
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="demo-notice">
        <Info size={16} />
        <span>
          {persistent
            ? 'Analyse enregistrée dans votre SCI. Résultats avant fiscalité.'
            : 'Simulation fictive avant fiscalité. Modifications conservées sur cette page uniquement.'}
          {modified ? ' Hypothèses modifiées.' : ''}
        </span>
      </div>
      <div className="detail-hero">
        <PropertyPhoto
          url={p.photoUrl ?? p.listing?.photos[0]}
          title={p.title}
          variant={p.color}
          large
          synthetic={!persistent}
        />
        <div className="hero-data">
          <div className="stat-label">Prix d’achat simulé</div>
          <div className="hero-price">{euro(v.price)}</div>
          <p>
            {euro(v.price / v.area)} / m² · Coût projet : {euro(a.totalCost)}
          </p>
          <div className="hero-metrics">
            <div>
              <small>Loyer HC / mois</small>
              <strong>{euro(v.monthlyRent)}</strong>
            </div>
            <div>
              <small>Rendement net</small>
              <strong>{pct(a.netYield)}</strong>
            </div>
            <div>
              <small>Cash-flow / mois</small>
              <strong className={a.cashFlowMonthly >= 0 ? 'positive' : 'negative'}>
                {euro(a.cashFlowMonthly)}
              </strong>
            </div>
            <div>
              <small>Score partiel</small>
              <strong>
                {score.score}
                <em>/100</em>
              </strong>
            </div>
          </div>
          <small className="muted">
            Score couvert à {pct(score.coverage)} · aucun prix de marché vérifié
          </small>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Analyse du bien">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${tabs.indexOf(t)}`}
            aria-controls="analysis-panel"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {p.listing && (
        <details className="panel">
          <summary>Annonce source et photos ({p.listing.photos.length})</summary>
          <p>
            <a href={p.listing.sourceUrl} target="_blank" rel="noopener noreferrer">
              Voir l’annonce source
            </a>{' '}
            ·{' '}
            {p.listing.method === 'url'
              ? 'Import par URL'
              : p.listing.method === 'html'
                ? 'Fichier HTML fourni'
                : 'Saisie utilisateur'}
          </p>
          <p className="muted">
            Photos externes : elles peuvent devenir indisponibles si l’annonce est retirée.
          </p>
          <div className="listing-photos">
            {p.listing.photos.map((url, i) => (
              <PropertyPhoto
                key={url}
                url={url}
                title={`${p.title} — photo ${i + 1}`}
                variant={p.color}
                synthetic={false}
              />
            ))}
          </div>
        </details>
      )}
      <section id="analysis-panel" role="tabpanel" aria-labelledby={`tab-${tabs.indexOf(tab)}`}>
        {tab === 'Visualisation' && (
          <>
            <RoomGallery propertyId={p.id} />
            <DesignStudio propertyId={p.id} />
          </>
        )}
        {tab === 'Travaux & scénarios' && (
          <RenovationBudget
            property={p}
            onApply={(next) => {
              setV(next);
              setDraft(next);
            }}
          />
        )}
        {tab === 'Caractéristiques' && (
          <>
            <PropertyEditor property={p} />
            {p.importData && <ImportSources data={p.importData} />}
          </>
        )}
        {tab === 'Échanges' && <PropertyCollaboration propertyId={p.id} />}
        {tab === 'Historique' && <PropertyHistory propertyId={p.id} />}
        {tab === tabs[0] && (
          <>
            <div className="two-columns">
              <section className="panel">
                <h2>Les chiffres qui comptent</h2>
                <dl className="data-list">
                  <Row label="Coût total du projet" value={euro(a.totalCost)} />
                  <Row label="Apport" value={euro(v.contribution)} />
                  <Row label="Emprunt" value={euro(a.principal)} />
                  <Row label="Loyers annuels encaissés" value={euro(a.collectedRent)} />
                  <Row label="Charges et provisions annuelles" value={euro(a.expenses)} />
                  <Row label="Mensualité assurance comprise" value={euro(a.loan.monthlyTotal)} />
                  <Row label="Rendement brut sur coût projet" value={pct(a.grossYield)} />
                  <Row label="Rendement net avant impôt" value={pct(a.netYield)} />
                  <Row label="Cash-on-cash avant impôt" value={pct(a.cashOnCash)} />
                  <Row
                    label="DSCR, assurance comprise"
                    value={
                      a.dscr === null
                        ? 'Non applicable (sans dette)'
                        : a.dscr.toLocaleString('fr-FR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                    }
                  />
                  <Row label="Effort d’épargne mensuel" value={euro(a.effortMonthly)} />
                  <Row
                    label="Capital remboursé la première année"
                    value={euro(a.firstYearPrincipal)}
                  />
                </dl>
                <details>
                  <summary>Comment ces chiffres sont-ils calculés ?</summary>
                  <p>
                    Rendement brut = loyer HC × 12 / coût total. Rendement net = (loyers après
                    vacance − charges − provisions) / coût total. Cash-flow = résultat net
                    d’exploitation − échéances − assurance. Cash-on-cash = cash-flow annuel /
                    apport. DSCR = résultat net d’exploitation / service annuel de la dette,
                    assurance incluse.
                  </p>
                  <p>
                    Le remboursement du capital réduit le cash-flow ; il n’est pas déduit une
                    seconde fois du rendement net. Fiscalité indisponible.
                  </p>
                  <Link href={`${basePath}/hypotheses`}>Toutes les conventions de calcul</Link>
                </details>
              </section>
              <section className="panel">
                <h2>Un score explicable</h2>
                <div className="score-display">
                  {score.score}
                  <span>/100</span>
                </div>
                <p className="muted">
                  Score partiel · couverture {pct(score.coverage)}. Renormalisé sur les critères
                  renseignés, il ne constitue pas une recommandation.
                </p>
                {score.criteria.map((c) => (
                  <details className="criterion" key={c.key}>
                    <summary>
                      <span>
                        {c.label} <small>({c.weight} %)</small>
                      </span>
                      <b>{c.score === null ? 'Indisponible' : `${Math.round(c.score)}/100`}</b>
                    </summary>
                    <p>{c.formula}</p>
                  </details>
                ))}
                <p className="micro">
                  Pondérations de démonstration. Le moteur accepte des pondérations configurables ;
                  l’éditeur familial viendra avec les paramètres SCI.
                </p>
              </section>
            </div>
            <section className="panel negotiation">
              <div>
                <h2>Quel prix proposer ?</h2>
                <p>
                  Prix maximal pour le cash-flow mensuel ciblé, à apport et charges constants.
                  Recherche plafonnée à deux fois le prix affiché.
                </p>
              </div>
              <label>
                Cash-flow cible (€/mois)
                <input
                  type="number"
                  value={Number.isNaN(target) ? '' : target}
                  onChange={(e) => setTarget(e.target.value === '' ? NaN : Number(e.target.value))}
                />
              </label>
              <div>
                <small>Prix maximal compatible</small>
                <strong>{maxPrice === null ? 'Objectif inaccessible' : euro(maxPrice)}</strong>
              </div>
            </section>
          </>
        )}
        {tab === tabs[1] && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Vos hypothèses, vos décisions</h2>
                <p>
                  {persistent
                    ? 'Ces hypothèses sont saisies par les membres de votre SCI. Vérifiez leur source avant de décider.'
                    : 'Tous les montants sont fictifs et modifiables. Aucun montant n’est une estimation locale.'}
                </p>
              </div>
              <button
                className="button"
                onClick={() => {
                  setDraft(p.investment);
                  setV(p.investment);
                }}
              >
                <RotateCcw size={15} />
                Réinitialiser
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSaved(false);
                if (valid.success && (await saveInvestment(p.id, valid.data))) {
                  setV(valid.data);
                  setSaved(persistent);
                }
              }}
            >
              <InvestmentFields value={draft} onChange={setDraft} />
              {!valid.success && (
                <div role="alert" className="error">
                  {valid.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' · ')}
                </div>
              )}
              <button
                className="button primary"
                disabled={!valid.success || busy || !canEdit}
                type="submit"
              >
                {persistent ? 'Enregistrer et recalculer' : 'Recalculer l’analyse'}
              </button>
              {saved && (
                <p className="positive" role="status">
                  Analyse enregistrée. Le comparateur utilise maintenant ces hypothèses.
                </p>
              )}
              <span className="form-note">
                {persistent
                  ? 'Chaque enregistrement conserve une version de l’analyse.'
                  : 'Les indicateurs ci-dessus changent après recalcul. Pas de sauvegarde permanente.'}
              </span>
            </form>
          </section>
        )}
        {tab === tabs[2] && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Votre financement en détail</h2>
                <p>
                  Prêt amortissable à taux fixe · {v.loanYears} ans · taux {pct(v.loanRate)} · sans
                  différé
                </p>
              </div>
              <button className="button" onClick={exportLoan}>
                <Download size={16} />
                Exporter CSV
              </button>
            </div>
            <div className="mini-stats">
              <div>
                <small>Mensualité avec assurance</small>
                <strong>{euro(a.loan.monthlyTotal, 2)}</strong>
              </div>
              <div>
                <small>Intérêts totaux</small>
                <strong>{euro(a.loan.totalInterest)}</strong>
              </div>
              <div>
                <small>Assurance totale</small>
                <strong>{euro(a.loan.totalInsurance)}</strong>
              </div>
              <div>
                <small>Coût du crédit hors frais</small>
                <strong>{euro(a.loan.creditCost)}</strong>
              </div>
            </div>
            <p className="micro">
              Assurance calculée sur le capital initial. Calcul en précision flottante, arrondi à
              l’affichage : l’échéancier contractuel peut différer de quelques centimes.
            </p>
            <div className="table-scroll loan-table">
              <table>
                <caption>Tableau d’amortissement complet</caption>
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th>Échéance hors assurance</th>
                    <th>Intérêts</th>
                    <th>Capital remboursé</th>
                    <th>Assurance</th>
                    <th>Restant dû</th>
                  </tr>
                </thead>
                <tbody>
                  {a.loan.schedule.map((r) => (
                    <tr key={r.month}>
                      <th>{r.month}</th>
                      <td>{euro(r.payment, 2)}</td>
                      <td>{euro(r.interest, 2)}</td>
                      <td>{euro(r.principal, 2)}</td>
                      <td>{euro(r.insurance, 2)}</td>
                      <td>{euro(r.balance, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {tab === tabs[3] && (
          <>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Votre horizon patrimonial</h2>
                  <p>
                    Hypothèses fictives · modifiables · hors fiscalité et distribution aux associés
                  </p>
                </div>
                <div className="segmented">
                  {scenarioFixtures.map((s, i) => (
                    <button
                      key={s.name}
                      aria-pressed={scenarioIndex === i}
                      className={scenarioIndex === i ? 'selected' : ''}
                      onClick={() => {
                        setScenarioIndex(i);
                        setScenario(s);
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="scenario-fields">
                {(
                  [
                    'priceGrowth',
                    'rentGrowth',
                    'expenseGrowth',
                    'vacancyRate',
                    'saleFeeRate',
                  ] as const
                ).map((key, i) => (
                  <label key={key}>
                    {
                      [
                        'Prix / an (%)',
                        'Loyers / an (%)',
                        'Charges / an (%)',
                        'Vacance (%)',
                        'Frais de vente (%)',
                      ][i]
                    }
                    <input
                      type="number"
                      step=".1"
                      value={Number.isNaN(scenario[key]) ? '' : scenario[key]}
                      onChange={(e) =>
                        setScenario({
                          ...scenario,
                          [key]: e.target.value === '' ? NaN : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              {!scenarioValid.success && (
                <p className="error" role="alert">
                  Hypothèses invalides. Le graphique utilise le scénario de référence sélectionné.
                </p>
              )}
              <p className="micro">
                Travaux futurs :{' '}
                {scenario.futureWorks.length
                  ? scenario.futureWorks
                      .map((w) => `${euro(w.amount)} en année ${w.year}`)
                      .join(', ')
                  : 'aucuns dans ce scénario'}
                . Hypothèses du scénario appliquées à partir de l’année 2 pour loyers et charges ;
                croissance de valeur dès l’année 1.
              </p>
              <div className="chart-legend">
                <span>
                  <i className="brown" />
                  Équité
                </span>
                <span>
                  <i className="sage" />
                  Valeur estimée
                </span>
                <span>
                  <i className="gray" />
                  Dette restante
                </span>
              </div>
              <ProjectionChart data={projection} />
              <div className="table-scroll">
                <table>
                  <caption>Revente et performance aux horizons clés, avant fiscalité</caption>
                  <thead>
                    <tr>
                      <th>Horizon</th>
                      <th>Valeur</th>
                      <th>Dette</th>
                      <th>Équité</th>
                      <th>Cash récupéré à la vente</th>
                      <th>Gain total avant impôt</th>
                      <th>Gain / apport</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projection
                      .filter((r) => r.year % 5 === 0)
                      .map((r) => (
                        <tr key={r.year}>
                          <th>{r.year} ans</th>
                          <td>{euro(r.value)}</td>
                          <td>{euro(r.balance)}</td>
                          <td>{euro(r.equity)}</td>
                          <td>{euro(r.saleCashBeforeTax)}</td>
                          <td>{euro(r.profitBeforeTax)}</td>
                          <td>{pct(r.returnOnContribution)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary>Comprendre la performance à la revente</summary>
                <p>
                  Cash récupéré = valeur de vente − frais de vente − dette restante. Gain total =
                  cash récupéré + cash-flows cumulés − apport initial. Le ratio gain / apport n’est
                  pas un rendement annualisé ni un TRI. Impôt de cession, indemnité de remboursement
                  anticipé et fiscalité des distributions : indisponibles, non déduits.
                </p>
              </details>
            </section>
            <section className="panel">
              <h2>Cash-flow annuel</h2>
              <CashFlowChart data={projection} />
            </section>
          </>
        )}
        {tab === tabs[4] && (
          <>
            <div className="risk-list">
              {[
                a.cashFlowMonthly < 0 ? 'Cash-flow négatif : prévoir un effort d’épargne.' : null,
                ['F', 'G'].includes(p.dpe)
                  ? 'DPE défavorable : vérifier les obligations et la possibilité de mise en location.'
                  : null,
                v.works / v.price > 0.2
                  ? 'Travaux importants : obtenir des devis et contrôler la marge de sécurité.'
                  : null,
                'Copropriété, liquidité et tension locative : données indisponibles.',
              ]
                .filter(Boolean)
                .map((t) => (
                  <div className="risk" key={t}>
                    <CircleAlert size={19} />
                    {t}
                  </div>
                ))}
            </div>
            <section className="panel">
              <h2>Résister aux imprévus</h2>
              <p className="muted">
                Tests isolés, non cumulés. Surcoût travaux financé par dette à apport constant. La
                hausse du taux ne concerne qu’un nouveau financement, pas un prêt fixe déjà signé.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Stress test</th>
                      <th>Cash-flow / mois</th>
                      <th>Rendement net</th>
                      <th>Équité à 20 ans</th>
                      <th>Gain à 20 ans avant impôt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stress.map((s) => (
                      <tr key={s.label}>
                        <th>{s.label}</th>
                        <td className={s.cashFlowMonthly < 0 ? 'negative' : 'positive'}>
                          {euro(s.cashFlowMonthly)}
                        </td>
                        <td>{pct(s.netYield)}</td>
                        <td>{euro(s.horizon.equity)}</td>
                        <td>{euro(s.horizon.profitBeforeTax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
        {tab === tabs[5] && (
          <div className="two-columns">
            <section className="panel">
              <h2>Fiscalité SCI</h2>
              <p>
                Le modèle de données prévoit les régimes SCI à l’IR et SCI à l’IS, les paramètres
                versionnés, les amortissements et la cession.
              </p>
              <div className="unavailable">Donnée indisponible</div>
              <p>
                Le moteur fiscal n’est pas implémenté dans cette version. Aucun impôt nul n’est
                supposé. Les calculs affichés sont avant fiscalité et ne constituent pas un conseil
                fiscal.
              </p>
            </section>
            <section className="panel">
              <h2>Marché local & loyer</h2>
              <dl className="data-list">
                <Row label="Prix demandé / m²" value={euro(v.price / v.area)} />
                <Row label="Prix de marché / m²" value="Donnée indisponible" />
                <Row label="Décote estimée" value="Donnée indisponible" />
                <Row label="Estimation locale du loyer" value="Donnée indisponible" />
              </dl>
              <p>
                Le loyer affiché est{' '}
                {persistent ? 'une hypothèse saisie par votre SCI' : 'une hypothèse fictive'}.
                Sources DVF, INSEE et loyers non connectées. Les données externes disposeront d’une
                source, d’une date et d’un niveau de confiance.
              </p>
            </section>
          </div>
        )}
      </section>
    </>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
