import { describe, expect, it } from 'vitest';
import {
  acquisitionCost,
  analyze,
  investmentSchema,
  loanEngine,
  negotiate,
  project,
  stressTests,
} from '../src/financial-engine';
import { properties, scenarioFixtures } from '../src/data/demo';
import { opportunityScore } from '../src/opportunity-engine';
import { unavailableTax } from '../src/tax-engine';
import { UserTextProvider } from '../src/listing-providers';
import { RentalEstimator } from '../src/market-data';
const input = properties[0].investment;
describe('Prêt amortissable', () => {
  it('retrouve une mensualité de référence indépendante', () => {
    const l = loanEngine({ principal: 200000, annualRate: 3, years: 20, insuranceRate: 0.3 });
    expect(l.payment).toBeCloseTo(1109.1952, 3);
    expect(l.insurance).toBe(50);
    expect(l.totalInterest).toBeCloseTo(66206.85, 2);
  });
  it('traite un taux nul et un capital nul', () => {
    expect(
      loanEngine({ principal: 120000, annualRate: 0, years: 10, insuranceRate: 0 }).payment,
    ).toBe(1000);
    expect(
      loanEngine({ principal: 0, annualRate: 3, years: 20, insuranceRate: 0.3 }).creditCost,
    ).toBe(0);
  });
  it.each([0, 0.0000001, 1, 3.5, 15])(
    'conserve le capital et solde le prêt au taux %s',
    (annualRate) => {
      const l = loanEngine({ principal: 183456.78, annualRate, years: 25, insuranceRate: 0.27 });
      expect(l.schedule).toHaveLength(300);
      expect(l.schedule.reduce((s, p) => s + p.principal, 0)).toBeCloseTo(183456.78, 6);
      expect(l.schedule.at(-1)?.balance).toBe(0);
      expect(l.schedule.every((p) => p.balance >= 0 && p.principal >= 0)).toBe(true);
      expect(l.schedule[0].interest).toBeCloseTo((183456.78 * annualRate) / 1200, 8);
    },
  );
  it.each([-1, NaN, Infinity])('rejette un capital invalide %s', (principal) => {
    expect(() => loanEngine({ principal, annualRate: 3, years: 20, insuranceRate: 0 })).toThrow();
  });
  it('rejette les durées invalides', () => {
    expect(() =>
      loanEngine({ principal: 1000, annualRate: 3, years: 0, insuranceRate: 0 }),
    ).toThrow();
  });
});
describe('Acquisition et exploitation', () => {
  const v = {
    ...input,
    price: 100000,
    acquisitionRate: 10,
    agencyFees: 1000,
    works: 10000,
    contingencyRate: 10,
    furniture: 1000,
    bankFees: 500,
    guaranteeFees: 1000,
    brokerFees: 500,
    otherFees: 100,
    contribution: 25000,
    monthlyRent: 1000,
    vacancyRate: 10,
    propertyTax: 1000,
    condoCharges: 500,
    pno: 100,
    accounting: 200,
    maintenance: 200,
    otherExpenses: 0,
    managementRate: 5,
    gliRate: 2,
    reserveRate: 3,
  };
  it('additionne tous les coûts sans double compter les travaux', () =>
    expect(acquisitionCost(v)).toBeCloseTo(125100, 8));
  it('applique les charges variables aux loyers encaissés', () => {
    const a = analyze(v);
    expect(a.collectedRent).toBe(10800);
    expect(a.expenses).toBe(3080);
    expect(a.noi).toBe(7720);
    expect(a.grossYield).toBeCloseTo((12000 / 125100) * 100, 10);
    expect(a.netYield).toBeCloseTo((7720 / 125100) * 100, 10);
    expect(a.cashFlowAnnual).toBeCloseTo(7720 - a.debtService, 8);
    expect(a.cashOnCash).toBeCloseTo((a.cashFlowAnnual / 25000) * 100, 8);
    expect(a.dscr).toBeCloseTo(7720 / a.debtService, 8);
  });
  it('ne confond pas absence de dette, absence d’apport et zéro rendement', () => {
    expect(analyze({ ...v, contribution: 0 }).cashOnCash).toBeNull();
    const a = analyze({ ...v, contribution: acquisitionCost(v) });
    expect(a.dscr).toBeNull();
    expect(a.debtService).toBe(0);
    expect(a.cashFlowAnnual).toBe(7720);
  });
  it('rejette dépassement d’apport et pourcentages invalides', () => {
    expect(investmentSchema.safeParse({ ...v, contribution: 1e9 }).success).toBe(false);
    expect(investmentSchema.safeParse({ ...v, vacancyRate: 101 }).success).toBe(false);
    expect(investmentSchema.safeParse({ ...v, price: 0 }).success).toBe(false);
  });
});
describe('Projections et sensibilité', () => {
  it('termine la dette et l’assurance à maturité et applique les travaux à la bonne année', () => {
    const v = { ...input, loanYears: 5 };
    const s = {
      ...scenarioFixtures[1],
      priceGrowth: 0,
      rentGrowth: 0,
      expenseGrowth: 0,
      futureWorks: [{ year: 6, amount: 1234 }],
    };
    const rows = project(v, s);
    expect(rows[4].balance).toBe(0);
    expect(rows[5].debtService).toBe(0);
    expect(rows[5].cashFlow).toBeCloseTo(analyze(v).noi - 1234, 7);
    expect(rows[0].value).toBe(input.price);
    expect(rows[24].profitBeforeTax).toBeCloseTo(
      rows[24].saleCashBeforeTax + rows[24].cumulativeCashFlow - v.contribution,
      8,
    );
  });
  it('conserve la cohérence de la première année', () => {
    const a = analyze(input),
      p = project(input, { ...scenarioFixtures[1], vacancyRate: input.vacancyRate });
    expect(p[0].cashFlow).toBeCloseTo(a.cashFlowAnnual, 7);
    expect(p[0].equity).toBeCloseTo(p[0].value - p[0].balance, 7);
  });
  it('est déterministe et ne modifie pas les entrées', () => {
    const copy = JSON.stringify(input);
    expect(project(input, scenarioFixtures[0])).toEqual(project(input, scenarioFixtures[0]));
    expect(JSON.stringify(input)).toBe(copy);
  });
  it('ordonne les scénarios et dégrade les résultats sous stress', () => {
    expect(project(input, scenarioFixtures[0])[19].profitBeforeTax).toBeLessThan(
      project(input, scenarioFixtures[2])[19].profitBeforeTax,
    );
    const tests = stressTests(input, scenarioFixtures[1]);
    expect(tests[0].cashFlowMonthly).toBeLessThan(analyze(input).cashFlowMonthly);
    expect(tests[1].cashFlowMonthly).toBeLessThan(tests[0].cashFlowMonthly);
    expect(tests[7].horizon.value).toBeCloseTo(input.price * 0.9, 6);
  });
  it('résout le prix cible avec apport fixe', () => {
    const price = negotiate(input, 0)!;
    expect(price).not.toBeNull();
    expect(analyze({ ...input, price }).cashFlowMonthly).toBeGreaterThanOrEqual(0);
    expect(analyze({ ...input, price: price + 1 }).cashFlowMonthly).toBeLessThan(0);
    expect(negotiate(input, 1e6)).toBeNull();
  });
});
describe('Données et transparence', () => {
  it('ne présente pas la fiscalité manquante comme nulle', () =>
    expect(unavailableTax().tax).toBeNull());
  it('indique la couverture du score', () => {
    const score = opportunityScore(input, 'C');
    expect(score.coverage).toBeCloseTo(55, 10);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(score.criteria.find((c) => c.key === 'discount')?.score).toBeNull();
  });
  it('parse uniquement les informations explicites du texte utilisateur', () => {
    const provider = new UserTextProvider();
    expect(provider.normalizeListing('Appartement de 63,5 m² à 178 000 €')).toMatchObject({
      area: 63.5,
      price: 178000,
      title: null,
    });
    expect(provider.normalizeListing('Appartement')).toMatchObject({ price: null, area: null });
  });
  it('ne fabrique pas de loyer sans source', () =>
    expect(new RentalEstimator().estimate(63, null)).toBeNull());
});
