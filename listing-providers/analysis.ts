import { analyze, investmentSchema, project } from '../financial-engine';
import { opportunityScore } from '../opportunity-engine';
/** Same engine for automatic, assisted and manual imports. No provider estimates are invented. */
export function analyzeImport(input: unknown, dpe: string | null) {
  const parsed = investmentSchema.safeParse(input);
  if (!parsed.success) return null;
  const v = parsed.data;
  const projection = project(
    v,
    {
      name: 'Hypothèses constantes',
      priceGrowth: 0,
      rentGrowth: 0,
      expenseGrowth: 0,
      vacancyRate: v.vacancyRate,
      saleFeeRate: 0,
      futureWorks: [],
    },
    20,
  );
  return {
    financial: analyze(v),
    opportunity: opportunityScore(v, dpe),
    tenYears: projection[9],
    twentyYears: projection[19],
  };
}
