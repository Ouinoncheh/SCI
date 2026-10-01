export type TaxRegime = 'SCI_IR' | 'SCI_IS';
export type TaxRule = {
  version: string;
  effectiveDate: string;
  source: string;
  comment: string;
  parameters: Record<string, number>;
};
export type TaxResult = {
  tax: number | null;
  taxableIncome: number | null;
  warnings: string[];
  rule: TaxRule | null;
};
export interface TaxEngine {
  regime: TaxRegime;
  simulate(income: number, deductibleExpenses: number, interest: number, rule: TaxRule): TaxResult;
}
export function unavailableTax(): TaxResult {
  return {
    tax: null,
    taxableIncome: null,
    rule: null,
    warnings: [
      'Donnée indisponible : simulation fiscale IR/IS non implémentée. Les résultats sont présentés avant fiscalité.',
    ],
  };
}
