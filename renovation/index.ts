import { z } from 'zod';
import { analyze, investmentSchema, type Investment } from '../financial-engine';
export const workCategories = {
  PAINT: 'Peinture',
  FLOOR: 'Sols',
  KITCHEN: 'Cuisine',
  BATHROOM: 'Salle de bain',
  PLUMBING: 'Plomberie',
  ELECTRICITY: 'Électricité',
  WINDOWS: 'Menuiseries',
  LIGHTING: 'Éclairage',
  FURNITURE: 'Ameublement',
  DECOR: 'Décoration',
  INSULATION: 'Isolation',
  PARTITIONS: 'Cloisonnement',
  OTHER: 'Autres',
} as const;
const money = z.number().finite().nonnegative().max(1e8).multipleOf(0.01);
export const expenseSchema = z
  .object({
    id: z.string().min(1).max(100),
    label: z.string().trim().min(1).max(150),
    amount: money,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }),
    reference: z.string().trim().max(150),
  })
  .strict();
export const workItemSchema = z
  .object({
    id: z.string().min(1).max(100),
    roomId: z.string().min(1).max(100).nullable(),
    category: z.enum([
      'PAINT',
      'FLOOR',
      'KITCHEN',
      'BATHROOM',
      'PLUMBING',
      'ELECTRICITY',
      'WINDOWS',
      'LIGHTING',
      'FURNITURE',
      'DECOR',
      'INSULATION',
      'PARTITIONS',
      'OTHER',
    ]),
    label: z.string().trim().min(1).max(150),
    quantity: z.number().finite().positive().max(100000),
    unit: z.enum(['forfait', 'm²', 'unité']),
    unitMin: money.nullable(),
    unitMax: money.nullable(),
    source: z.enum(['USER_ESTIMATE', 'QUOTE']),
    notes: z.string().max(1000),
    contractor: z.string().trim().max(150).optional(),
    quoteReference: z.string().trim().max(150).optional(),
    quoteStatus: z.enum(['REQUESTED', 'RECEIVED', 'ACCEPTED', 'DECLINED']).optional(),
    expenses: z.array(expenseSchema).max(100).optional(),
    actualFinal: z.boolean().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.unitMin !== null && v.unitMax !== null && v.unitMax < v.unitMin)
      ctx.addIssue({
        code: 'custom',
        path: ['unitMax'],
        message: 'Le maximum doit être supérieur ou égal au minimum.',
      });
    if (new Set(v.expenses?.map((expense) => expense.id)).size !== (v.expenses?.length ?? 0))
      ctx.addIssue({ code: 'custom', path: ['expenses'], message: 'Dépenses dupliquées.' });
  });
export const renovationSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(2000),
    monthlyRent: money.nullable(),
    contingencyRate: z.number().finite().min(0).max(100),
    budgetMode: z.enum(['LOW', 'CENTRAL', 'HIGH']),
    items: z.array(workItemSchema).min(1).max(100),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.items.map((r) => r.id)).size !== v.items.length)
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Identifiants de postes dupliqués.',
      });
  });
export type RenovationInput = z.infer<typeof renovationSchema>;
export type WorkItem = z.infer<typeof workItemSchema>;
export type RenovationScenario = RenovationInput & {
  id: string;
  version: number;
  favorite: boolean;
  updatedAt: string;
};
export const emptyRenovation = (): RenovationInput => ({
  name: 'Scénario économique',
  description: '',
  monthlyRent: null,
  contingencyRate: 0,
  budgetMode: 'CENTRAL',
  items: [],
});
const cents = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export function renovationBudget(input: RenovationInput) {
  const items = input.items.map((r) => ({
    ...r,
    min: r.unitMin === null ? null : cents(r.quantity * r.unitMin),
    max: r.unitMax === null ? null : cents(r.quantity * r.unitMax),
  }));
  const missing = items.filter(
    (r, i) => r.min === null || r.max === null || !workItemSchema.safeParse(input.items[i]).success,
  );
  if (!items.length || missing.length)
    return { complete: false as const, items, missing: missing.map((r) => r.label), range: null };
  const total = (category: 'works' | 'furniture', bound: 'min' | 'max') =>
    cents(
      items
        .filter((r) => (r.category === 'FURNITURE') === (category === 'furniture'))
        .reduce((sum, r) => sum + r[bound]!, 0),
    );
  const low = { works: total('works', 'min'), furniture: total('furniture', 'min') };
  const high = { works: total('works', 'max'), furniture: total('furniture', 'max') };
  const central = {
    works: cents((low.works + high.works) / 2),
    furniture: cents((low.furniture + high.furniture) / 2),
  };
  const totals = (v: typeof low) => ({
    ...v,
    contingency: cents((v.works * input.contingencyRate) / 100),
    total: cents(v.works * (1 + input.contingencyRate / 100) + v.furniture),
  });
  return {
    complete: true as const,
    items,
    missing: [],
    range: { LOW: totals(low), CENTRAL: totals(central), HIGH: totals(high) },
  };
}
export function compareRenovation(base: Investment, input: RenovationInput) {
  const budget = renovationBudget(input);
  if (!budget.complete)
    return {
      budget,
      investment: null,
      financial: null,
      error: 'Complétez les montants minimum et maximum de chaque poste.',
    };
  const selected = budget.range[input.budgetMode];
  // Replace works and furniture; never add the old totals a second time.
  const candidate = {
    ...base,
    works: selected.works,
    furniture: selected.furniture,
    contingencyRate: input.contingencyRate,
    monthlyRent: input.monthlyRent ?? base.monthlyRent,
  };
  const valid = investmentSchema.safeParse(candidate);
  if (!valid.success)
    return {
      budget,
      investment: null,
      financial: null,
      error:
        'Hypothèses financières incompatibles : vérifiez notamment l’apport par rapport au coût total.',
    };
  const financial = analyze(valid.data);
  return { budget, investment: valid.data, financial, error: null };
}

export function roomBudgets(input: RenovationInput) {
  const groups = new Map<string | null, WorkItem[]>();
  for (const item of input.items)
    groups.set(item.roomId, [...(groups.get(item.roomId) ?? []), item]);
  return [...groups].map(([roomId, items]) => {
    const budget = renovationBudget({ ...input, items });
    return {
      roomId,
      count: items.length,
      min: budget.complete ? cents(budget.range.LOW.works + budget.range.LOW.furniture) : null,
      max: budget.complete ? cents(budget.range.HIGH.works + budget.range.HIGH.furniture) : null,
    };
  });
}

export function renovationSpending(input: RenovationInput) {
  const budget = renovationBudget(input);
  const items = input.items.map((item) => ({
    id: item.id,
    paid: cents((item.expenses ?? []).reduce((sum, expense) => sum + expense.amount, 0)),
    final: item.actualFinal === true,
    furniture: item.category === 'FURNITURE',
  }));
  const paid = cents(items.reduce((sum, item) => sum + item.paid, 0));
  const planned = budget.complete ? budget.range[input.budgetMode].total : null;
  return {
    items,
    paid,
    planned,
    remaining: planned === null ? null : cents(planned - paid),
    final: items.length > 0 && items.every((item) => item.final),
  };
}
export function compareActualRenovation(base: Investment, input: RenovationInput) {
  const spending = renovationSpending(input);
  if (!spending.final || !renovationSchema.safeParse(input).success) return null;
  const candidate = investmentSchema.safeParse({
    ...base,
    works: cents(
      spending.items.filter((item) => !item.furniture).reduce((sum, item) => sum + item.paid, 0),
    ),
    furniture: cents(
      spending.items.filter((item) => item.furniture).reduce((sum, item) => sum + item.paid, 0),
    ),
    contingencyRate: 0,
    monthlyRent: input.monthlyRent ?? base.monthlyRent,
  });
  return candidate.success ? analyze(candidate.data) : null;
}
