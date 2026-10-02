import { z } from 'zod';

const money = z.number().finite().min(0).max(1e10);
const percent = z.number().finite().min(0).max(100);
export const investmentSchema = z
  .object({
    price: money.positive(),
    area: z.number().finite().positive().max(1e6),
    acquisitionRate: percent,
    agencyFees: money,
    works: money,
    contingencyRate: percent,
    furniture: money,
    bankFees: money,
    guaranteeFees: money,
    brokerFees: money,
    otherFees: money,
    contribution: money,
    loanRate: percent,
    loanYears: z.number().int().min(1).max(40),
    insuranceRate: percent,
    monthlyRent: money,
    rentPending: z.boolean().optional(),
    vacancyRate: percent,
    propertyTax: money,
    condoCharges: money,
    pno: money,
    accounting: money,
    maintenance: money,
    otherExpenses: money,
    managementRate: percent,
    gliRate: percent,
    reserveRate: percent,
  })
  .superRefine((v, ctx) => {
    if (v.contribution > acquisitionCost(v))
      ctx.addIssue({
        code: 'custom',
        path: ['contribution'],
        message: 'L’apport dépasse le coût total du projet.',
      });
  });
export type Investment = z.infer<typeof investmentSchema>;
export type LoanInput = {
  principal: number;
  annualRate: number;
  years: number;
  insuranceRate: number;
};
export type Payment = {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  insurance: number;
  balance: number;
};

/** Fees include only agency fees not already included in purchase price. */
export function acquisitionCost(v: Investment): number {
  return (
    v.price * (1 + v.acquisitionRate / 100) +
    v.agencyFees +
    v.works * (1 + v.contingencyRate / 100) +
    v.furniture +
    v.bankFees +
    v.guaranteeFees +
    v.brokerFees +
    v.otherFees
  );
}

export function loanEngine(input: LoanInput) {
  const v = z
    .object({
      principal: money,
      annualRate: percent,
      years: z.number().int().min(1).max(40),
      insuranceRate: percent,
    })
    .parse(input);
  const count = v.years * 12;
  const r = v.annualRate / 1200;
  const payment =
    r === 0 ? v.principal / count : (v.principal * r) / -Math.expm1(-count * Math.log1p(r));
  const insurance = (v.principal * v.insuranceRate) / 1200;
  let balance = v.principal;
  const schedule: Payment[] = [];
  for (let month = 1; month <= count; month++) {
    const interest = balance * r;
    const principal =
      month === count ? balance : Math.min(balance, Math.max(0, payment - interest));
    balance = Math.max(0, balance - principal);
    schedule.push({
      month,
      payment: principal + interest,
      principal,
      interest,
      insurance,
      balance,
    });
  }
  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
  return {
    payment,
    insurance,
    monthlyTotal: payment + insurance,
    schedule,
    totalInterest,
    totalInsurance: insurance * count,
    creditCost: totalInterest + insurance * count,
  };
}

export function operatingResult(
  v: Investment,
  year = 1,
  rentGrowth = 0,
  expenseGrowth = 0,
  vacancyRate = v.vacancyRate,
) {
  const scheduledRent = v.monthlyRent * 12 * (1 + rentGrowth / 100) ** (year - 1);
  const collectedRent = scheduledRent * (1 - vacancyRate / 100);
  const fixed =
    (v.propertyTax + v.condoCharges + v.pno + v.accounting + v.maintenance + v.otherExpenses) *
    (1 + expenseGrowth / 100) ** (year - 1);
  const variable = (collectedRent * (v.managementRate + v.gliRate + v.reserveRate)) / 100;
  return {
    scheduledRent,
    collectedRent,
    expenses: fixed + variable,
    noi: collectedRent - fixed - variable,
  };
}

export function analyze(input: Investment) {
  const v = investmentSchema.parse(input);
  const totalCost = acquisitionCost(v);
  const principal = totalCost - v.contribution;
  const loan = loanEngine({
    principal,
    annualRate: v.loanRate,
    years: v.loanYears,
    insuranceRate: v.insuranceRate,
  });
  const operations = operatingResult(v);
  const debtService = loan.monthlyTotal * 12;
  const cashFlowAnnual = operations.noi - debtService;
  return {
    totalCost,
    principal,
    loan,
    ...operations,
    debtService,
    grossYield: (operations.scheduledRent / totalCost) * 100,
    netYield: (operations.noi / totalCost) * 100,
    cashFlowAnnual,
    cashFlowMonthly: cashFlowAnnual / 12,
    cashOnCash: v.contribution > 0 ? (cashFlowAnnual / v.contribution) * 100 : null,
    dscr: debtService > 0 ? operations.noi / debtService : null,
    effortMonthly: Math.max(0, -cashFlowAnnual / 12),
    firstYearPrincipal: loan.schedule.slice(0, 12).reduce((s, p) => s + p.principal, 0),
    afterTaxYield: null,
  };
}

export const scenarioSchema = z.object({
  name: z.string(),
  priceGrowth: z.number().finite().min(-50).max(50),
  rentGrowth: z.number().finite().min(-50).max(50),
  expenseGrowth: z.number().finite().min(-50).max(50),
  vacancyRate: percent,
  saleFeeRate: percent,
  futureWorks: z.array(z.object({ year: z.number().int().min(1).max(25), amount: money })),
});
export type Scenario = z.infer<typeof scenarioSchema>;
export function project(input: Investment, scenarioInput: Scenario, years = 25) {
  const v = investmentSchema.parse(input);
  const s = scenarioSchema.parse(scenarioInput);
  z.number().int().min(1).max(25).parse(years);
  const a = analyze(v);
  let cumulativeCashFlow = 0;
  return Array.from({ length: years }, (_, index) => {
    const year = index + 1;
    const payments = a.loan.schedule.slice(index * 12, year * 12);
    const debtService = payments.reduce((sum, p) => sum + p.payment + p.insurance, 0);
    const balance = payments.length ? payments[payments.length - 1].balance : 0;
    const op = operatingResult(v, year, s.rentGrowth, s.expenseGrowth, s.vacancyRate);
    const futureWorks = s.futureWorks
      .filter((w) => w.year === year)
      .reduce((sum, w) => sum + w.amount, 0);
    const cashFlow = op.noi - debtService - futureWorks;
    cumulativeCashFlow += cashFlow;
    // Renovation cost does not automatically increase market value.
    const value = v.price * (1 + s.priceGrowth / 100) ** year;
    const equity = value - balance;
    const saleFees = (value * s.saleFeeRate) / 100;
    const saleCashBeforeTax = value - saleFees - balance;
    const profitBeforeTax = saleCashBeforeTax + cumulativeCashFlow - v.contribution;
    return {
      year,
      value,
      balance,
      equity,
      rent: op.collectedRent,
      expenses: op.expenses,
      debtService,
      futureWorks,
      cashFlow,
      cumulativeCashFlow,
      saleFees,
      saleCashBeforeTax,
      profitBeforeTax,
      returnOnContribution: v.contribution > 0 ? (profitBeforeTax / v.contribution) * 100 : null,
      tax: null,
      saleTax: null,
    };
  });
}

export function stressTests(v: Investment, scenario: Scenario) {
  const variants: { label: string; investment: Investment; scenario: Scenario }[] = [
    { label: 'Loyer −10 %', investment: { ...v, monthlyRent: v.monthlyRent * 0.9 }, scenario },
    { label: 'Loyer −20 %', investment: { ...v, monthlyRent: v.monthlyRent * 0.8 }, scenario },
    {
      label: 'Vacance +10 points',
      investment: { ...v, vacancyRate: Math.min(100, v.vacancyRate + 10) },
      scenario: { ...scenario, vacancyRate: Math.min(100, scenario.vacancyRate + 10) },
    },
    { label: 'Travaux +20 %', investment: { ...v, works: v.works * 1.2 }, scenario },
    { label: 'Travaux +40 %', investment: { ...v, works: v.works * 1.4 }, scenario },
    {
      label: 'Charges +15 %',
      investment: {
        ...v,
        propertyTax: v.propertyTax * 1.15,
        condoCharges: v.condoCharges * 1.15,
        pno: v.pno * 1.15,
        accounting: v.accounting * 1.15,
        maintenance: v.maintenance * 1.15,
        otherExpenses: v.otherExpenses * 1.15,
        managementRate: Math.min(100, v.managementRate * 1.15),
        gliRate: Math.min(100, v.gliRate * 1.15),
        reserveRate: Math.min(100, v.reserveRate * 1.15),
      },
      scenario,
    },
    { label: 'Prix stagnant', investment: v, scenario: { ...scenario, priceGrowth: 0 } },
    {
      label: 'Prix −10 % à 20 ans',
      investment: v,
      scenario: { ...scenario, priceGrowth: (Math.pow(0.9, 1 / 20) - 1) * 100 },
    },
    {
      label: 'Taux +1 pt (nouveau prêt)',
      investment: { ...v, loanRate: Math.min(100, v.loanRate + 1) },
      scenario,
    },
  ];
  return variants.map((item) => ({
    label: item.label,
    ...analyze(item.investment),
    horizon: project(item.investment, item.scenario, 20)[19],
  }));
}

/** Fixed cash contribution; all additional acquisition costs are debt-financed. */
export function negotiate(v: Investment, targetMonthlyCash: number, maxBudget = v.price * 2) {
  z.number().finite().parse(targetMonthlyCash);
  money.positive().parse(maxBudget);
  const fixedCosts = acquisitionCost(v) - v.price * (1 + v.acquisitionRate / 100);
  let low = Math.max(0.01, (v.contribution - fixedCosts) / (1 + v.acquisitionRate / 100));
  let high = maxBudget;
  const evaluate = (price: number) => analyze({ ...v, price }).cashFlowMonthly;
  if (low > high || evaluate(low) < targetMonthlyCash) return null;
  if (evaluate(high) >= targetMonthlyCash) return high;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    if (evaluate(mid) >= targetMonthlyCash) low = mid;
    else high = mid;
  }
  return Math.floor(low * 100) / 100;
}
