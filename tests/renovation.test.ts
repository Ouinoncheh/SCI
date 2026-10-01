import { describe, it, expect } from 'vitest';
import {
  compareRenovation,
  renovationBudget,
  renovationSchema,
  roomBudgets,
  renovationSpending,
  compareActualRenovation,
  expenseSchema,
  type RenovationInput,
} from '../src/renovation';
import { properties } from '../src/data/demo';
const scenario: RenovationInput = {
  name: 'Standard',
  description: '',
  monthlyRent: null,
  contingencyRate: 10,
  budgetMode: 'CENTRAL',
  items: [
    {
      id: 'a',
      roomId: null,
      category: 'PAINT',
      label: 'Peinture',
      quantity: 20,
      unit: 'm²',
      unitMin: 10,
      unitMax: 20,
      source: 'USER_ESTIMATE',
      notes: '',
    },
    {
      id: 'b',
      roomId: null,
      category: 'FURNITURE',
      label: 'Mobilier',
      quantity: 1,
      unit: 'forfait',
      unitMin: 1000,
      unitMax: 1200,
      source: 'QUOTE',
      notes: 'Devis D1',
    },
  ],
};
describe('budgets travaux', () => {
  it('distingue les paiements connus des coûts finaux et inclut les imprévus dans le prévu', () => {
    expect(renovationSpending(scenario)).toMatchObject({
      paid: 0,
      final: false,
      planned: 1430,
      remaining: 1430,
    });
    expect(compareActualRenovation(properties[0].investment, scenario)).toBeNull();
    const completed = {
      ...scenario,
      items: scenario.items.map((item) => ({
        ...item,
        actualFinal: true,
        expenses: [
          {
            id: item.id,
            label: 'Facture',
            date: '2026-10-01',
            amount: item.category === 'FURNITURE' ? 1000 : 600,
            reference: 'F1',
          },
        ],
      })),
    };
    expect(renovationSpending(completed)).toMatchObject({
      paid: 1600,
      final: true,
      remaining: -170,
    });
    expect(
      compareActualRenovation(properties[0].investment, completed)?.cashFlowMonthly,
    ).toBeTypeOf('number');
    expect(
      renovationSpending({ ...scenario, items: [{ ...scenario.items[0], unitMin: null }] }).planned,
    ).toBeNull();
  });
  it('valide les dates, montants et identifiants de paiements', () => {
    const expense = { id: 'e', label: 'Acompte', amount: 100, date: '2026-02-28', reference: '' };
    expect(expenseSchema.safeParse(expense).success).toBe(true);
    for (const patch of [{ date: '2026-02-30' }, { amount: -1 }, { amount: 1.001 }, { label: '' }])
      expect(expenseSchema.safeParse({ ...expense, ...patch }).success).toBe(false);
    expect(
      renovationSchema.safeParse({
        ...scenario,
        items: [{ ...scenario.items[0], expenses: [expense, expense] }],
      }).success,
    ).toBe(false);
    expect(renovationSchema.safeParse(scenario).success).toBe(true);
  });
  it('regroupe les pièces sans masquer un poste inconnu', () => {
    const groups = roomBudgets({
      ...scenario,
      items: [
        { ...scenario.items[0], roomId: 'salon' },
        { ...scenario.items[1], unitMax: null },
      ],
    });
    expect(groups).toEqual([
      { roomId: 'salon', count: 1, min: 200, max: 400 },
      { roomId: null, count: 1, min: null, max: null },
    ]);
  });
  it('multiplie les quantités, sépare mobilier et travaux et applique les imprévus une seule fois', () => {
    const budget = renovationBudget(scenario);
    expect(budget.complete).toBe(true);
    expect(budget.range?.CENTRAL).toEqual({
      works: 300,
      furniture: 1100,
      contingency: 30,
      total: 1430,
    });
    expect(budget.range?.LOW.total).toBe(1220);
    expect(budget.range?.HIGH.total).toBe(1640);
  });
  it('garde les prix inconnus indisponibles, sans budget partiel trompeur', () => {
    const result = compareRenovation(properties[0].investment, {
      ...scenario,
      items: [{ ...scenario.items[0], unitMax: null }],
    });
    expect(result.budget.complete).toBe(false);
    expect(result.financial).toBeNull();
    expect(result.investment).toBeNull();
  });
  it('remplace les anciens totaux et hérite uniquement des autres hypothèses', () => {
    const base = properties[0].investment;
    const original = JSON.stringify(base);
    const result = compareRenovation(base, scenario);
    expect(result.investment).toMatchObject({
      works: 300,
      furniture: 1100,
      contingencyRate: 10,
      monthlyRent: base.monthlyRent,
      price: base.price,
      contribution: base.contribution,
    });
    expect(JSON.stringify(base)).toBe(original);
  });
  it('compare bas et haut à loyer inchangé sans valorisation automatique', () => {
    const low = compareRenovation(properties[0].investment, { ...scenario, budgetMode: 'LOW' }),
      high = compareRenovation(properties[0].investment, { ...scenario, budgetMode: 'HIGH' });
    expect(high.financial!.loan.monthlyTotal).toBeGreaterThan(low.financial!.loan.monthlyTotal);
    expect(high.financial!.cashFlowMonthly).toBeLessThan(low.financial!.cashFlowMonthly);
    expect(high.investment!.monthlyRent).toBe(low.investment!.monthlyRent);
  });
  it('honore le loyer saisi, y compris zéro explicite', () => {
    expect(
      compareRenovation(properties[0].investment, { ...scenario, monthlyRent: 0 }).investment!
        .monthlyRent,
    ).toBe(0);
    expect(
      compareRenovation(properties[0].investment, { ...scenario, monthlyRent: 1300 }).investment!
        .monthlyRent,
    ).toBe(1300);
  });
  it('refuse les fourchettes inversées, doublons et quantités négatives', () => {
    for (const items of [
      [{ ...scenario.items[0], unitMin: 30, unitMax: 20 }],
      [scenario.items[0], scenario.items[0]],
      [{ ...scenario.items[0], quantity: -1 }],
    ])
      expect(renovationSchema.safeParse({ ...scenario, items }).success).toBe(false);
  });
  it('ne calcule pas un financement avec un apport dépassant le coût du scénario', () => {
    const result = compareRenovation({ ...properties[0].investment, contribution: 1e8 }, scenario);
    expect(result.financial).toBeNull();
    expect(result.error).toContain('apport');
  });
});
