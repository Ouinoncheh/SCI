'use client';
import { useState } from 'react';
import Link from 'next/link';
import { analyze, project } from '@/financial-engine';
import { scenarioFixtures } from '@/data/demo';
import { opportunityScore } from '@/opportunity-engine';
import { useDemo } from '@/ui/demo-context';
import { euro, pct } from '@/ui/format';
import { PageHeading, Empty } from '@/ui/shell';
import { ComparisonChart } from '@/ui/charts';
export default function Compare() {
  const { items, persistent, basePath } = useDemo();
  const [ids, setIds] = useState(items.slice(0, 3).map((p) => p.id));
  const selected = items
    .filter((p) => ids.includes(p.id))
    .map((p) => ({
      p,
      a: analyze(p.investment),
      pr: project(p.investment, scenarioFixtures[1]),
      s: opportunityScore(p.investment, p.dpe),
    }));
  const metrics: [string, (v: (typeof selected)[number]) => string][] = [
    ['Prix d’achat', (x) => euro(x.p.investment.price)],
    ['Surface', (x) => `${x.p.investment.area} m²`],
    ['Prix / m²', (x) => euro(x.p.investment.price / x.p.investment.area)],
    ['Travaux hors marge', (x) => euro(x.p.investment.works)],
    ['Coût total du projet', (x) => euro(x.a.totalCost)],
    ['Apport', (x) => euro(x.p.investment.contribution)],
    ['Loyer HC / mois', (x) => x.p.investment.rentPending ? 'À estimer' : euro(x.p.investment.monthlyRent)],
    ['Mensualité avec assurance', (x) => euro(x.a.loan.monthlyTotal)],
    ['Rendement brut', (x) => pct(x.a.grossYield)],
    ['Rendement net avant impôt', (x) => x.p.investment.rentPending ? 'À estimer' : pct(x.a.netYield)],
    ['Cash-flow mensuel', (x) => x.p.investment.rentPending ? 'À estimer' : euro(x.a.cashFlowMonthly)],
    ['Cash-on-cash', (x) => pct(x.a.cashOnCash)],
    ['Score partiel', (x) => `${x.s.score}/100 · couverture ${pct(x.s.coverage)}`],
    [
      'Risque de trésorerie',
      (x) => (x.a.cashFlowMonthly < 0 ? 'Effort d’épargne requis' : 'Excédent simulé'),
    ],
    ['DPE déclaré', (x) => x.p.dpe],
    ['Équité à 10 ans', (x) => euro(x.pr[9].equity)],
    ['Équité à 20 ans', (x) => euro(x.pr[19].equity)],
    ['Gain revente à 20 ans avant impôt', (x) => euro(x.pr[19].profitBeforeTax)],
    ['Fiscalité', () => 'Donnée indisponible'],
  ];
  return (
    <>
      <PageHeading
        eyebrow="PRENDRE DU RECUL"
        title="Les bons critères. Côte à côte."
        description="Comparez jusqu’à quatre biens avec les mêmes conventions de calcul."
        action={false}
      />
      <div className="compare-selection">
        {items.map((p) => (
          <label key={p.id} className={ids.includes(p.id) ? 'checked' : ''}>
            <input
              type="checkbox"
              checked={ids.includes(p.id)}
              disabled={!ids.includes(p.id) && ids.length >= 4}
              onChange={() =>
                setIds(ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id])
              }
            />
            <div>
              <strong>{p.city}</strong>
              <small>{p.title}</small>
            </div>
          </label>
        ))}
      </div>
      {selected.length < 2 ? (
        <Empty
          title="Sélectionnez au moins deux biens"
          text="Cochez les investissements que vous souhaitez comparer."
        />
      ) : (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Votre comparaison</h2>
                <p>
                  {persistent ? 'Dernières analyses enregistrées' : 'Hypothèses fictives initiales'}{' '}
                  · avant fiscalité · projections au scénario central
                </p>
              </div>
            </div>
            <div className="table-scroll">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Indicateurs</th>
                    {selected.map((x) => (
                      <th key={x.p.id}>
                        <Link href={`${basePath}/biens/${x.p.id}`}>{x.p.city} ↗</Link>
                        <small>{x.p.title}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(([label, fn]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      {selected.map((x) => (
                        <td key={x.p.id}>{fn(x)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h2>Quel effort d’épargne chaque mois ?</h2>
            <p className="muted">
              Un cash-flow négatif représente un apport de trésorerie récurrent.
            </p>
            <ComparisonChart
              data={selected.map((x) => ({
                name: x.p.city,
                cashflow: Math.round(x.a.cashFlowMonthly),
              }))}
            />
          </section>
        </>
      )}
      <p className="micro">
        {persistent
          ? 'Le comparateur utilise les dernières hypothèses enregistrées. Les projections utilisent le scénario central d’exemple.'
          : 'Les simulations temporaires effectuées sur une page d’analyse ne remplacent pas les hypothèses initiales du comparateur.'}
      </p>
    </>
  );
}
