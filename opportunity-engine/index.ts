import { analyze, type Investment } from '../financial-engine';
export const defaultWeights = {
  yield: 25,
  cashflow: 20,
  discount: 15,
  sector: 15,
  risk: 10,
  dpe: 5,
  liquidity: 5,
  works: 5,
};
export type Weights = typeof defaultWeights;
const clamp = (n: number) => Math.max(0, Math.min(100, n));
export function opportunityScore(
  v: Investment,
  dpe: string | null,
  weights: Weights = defaultWeights,
) {
  if (
    Object.values(weights).some((w) => !Number.isFinite(w) || w < 0) ||
    Object.values(weights).every((w) => w === 0)
  )
    throw new Error('Pondérations invalides');
  const a = analyze(v);
  const criteria = [
    {
      key: 'yield' as const,
      label: 'Rendement net',
      score: clamp((a.netYield / 8) * 100),
      formula: 'Rendement net / 8 % × 100 (borné à 0–100)',
    },
    {
      key: 'cashflow' as const,
      label: 'Cash-flow',
      score: clamp(50 + a.cashFlowMonthly / 10),
      formula: '50 + cash-flow mensuel / 10 (borné à 0–100)',
    },
    {
      key: 'discount' as const,
      label: 'Décote de marché',
      score: null,
      formula: 'Donnée indisponible',
    },
    {
      key: 'sector' as const,
      label: 'Potentiel du secteur',
      score: null,
      formula: 'Donnée indisponible',
    },
    { key: 'risk' as const, label: 'Risque global', score: null, formula: 'Donnée indisponible' },
    {
      key: 'dpe' as const,
      label: 'DPE déclaré',
      score:
        dpe && /^[A-G]$/.test(dpe)
          ? ({ A: 100, B: 90, C: 75, D: 55, E: 30, F: 10, G: 0 }[dpe] ?? null)
          : null,
      formula: 'A : 100 · B : 90 · C : 75 · D : 55 · E : 30 · F : 10 · G : 0',
    },
    { key: 'liquidity' as const, label: 'Liquidité', score: null, formula: 'Donnée indisponible' },
    {
      key: 'works' as const,
      label: 'Complexité des travaux',
      score: clamp(100 - (v.works / v.price) * 200),
      formula: '100 − travaux / prix × 200 (borné à 0–100)',
    },
  ].map((c) => ({ ...c, weight: weights[c.key] }));
  const allWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const covered = criteria.reduce((s, c) => s + (c.score !== null ? c.weight : 0), 0);
  return {
    score: covered
      ? Math.round(criteria.reduce((s, c) => s + (c.score ?? 0) * c.weight, 0) / covered)
      : null,
    coverage: (covered / allWeight) * 100,
    criteria,
  };
}
