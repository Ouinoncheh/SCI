'use client';
import type { Investment } from '../financial-engine';
import { analyzeImport } from '../listing-providers/analysis';
import { euro, pct } from './format';
export function ImportAnalysis({ investment, dpe }: { investment: Investment; dpe: string }) {
  const result = analyzeImport(investment, dpe === '?' ? null : dpe);
  return (
    <section className="panel">
      <h2>Analyse du projet</h2>
      <p>
        Loyer et travaux estimés : données indisponibles. Les calculs utilisent vos hypothèses
        renseignées.
      </p>
      {result ? (
        <>
          <dl className="form-grid">
            {Object.entries({
              Prix: euro(investment.price),
              Surface: `${investment.area} m²`,
              'Prix au m²': euro(investment.price / investment.area),
              'Coût total': euro(result.financial.totalCost),
              'Mensualité avec assurance': euro(result.financial.loan.monthlyTotal),
              'Rentabilité brute': pct(result.financial.grossYield),
              'Rentabilité nette avant impôt': pct(result.financial.netYield),
              'Cash-flow mensuel avant impôt': euro(result.financial.cashFlowMonthly),
              'Patrimoine net à 10 ans': euro(result.tenYears.equity),
              'Patrimoine net à 20 ans': euro(result.twentyYears.equity),
              'Opportunity Score': `${result.opportunity.score ?? 'Indisponible'}/100 · couverture ${Math.round(result.opportunity.coverage)} %`,
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="muted">
            Projection illustrative à prix, loyers et charges constants, sans travaux futurs ni
            frais de revente. Fiscalité indisponible. Les scénarios restent modifiables après
            enregistrement.
          </p>
        </>
      ) : (
        <p>
          Complétez le prix, la surface, le loyer et les hypothèses de financement pour lancer le
          moteur.
        </p>
      )}
    </section>
  );
}
