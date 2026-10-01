'use client';
import type { Investment } from '@/financial-engine';
import {
  compareActualRenovation,
  expenseSchema,
  renovationSpending,
  type RenovationInput,
  type WorkItem,
} from '@/renovation';
import { euro, pct } from './format';

export function WorkSpendingEditor({
  item,
  change,
}: {
  item: WorkItem;
  change: (value: Partial<WorkItem>) => void;
}) {
  const expenses = item.expenses ?? [];
  const edit = (id: string, patch: Partial<(typeof expenses)[number]>) =>
    change({
      expenses: expenses.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense)),
    });
  return (
    <details>
      <summary>Devis et dépenses de ce poste</summary>
      <div className="form-grid">
        <label>
          Entreprise / artisan
          <input
            maxLength={150}
            value={item.contractor ?? ''}
            onChange={(event) => change({ contractor: event.target.value })}
          />
        </label>
        <label>
          Référence du devis
          <input
            maxLength={150}
            value={item.quoteReference ?? ''}
            onChange={(event) => change({ quoteReference: event.target.value })}
          />
        </label>
        <label>
          État du devis
          <select
            value={item.quoteStatus ?? ''}
            onChange={(event) =>
              change({
                quoteStatus: event.target.value
                  ? (event.target.value as WorkItem['quoteStatus'])
                  : undefined,
              })
            }
          >
            <option value="">Non renseigné</option>
            <option value="REQUESTED">Demandé</option>
            <option value="RECEIVED">Reçu</option>
            <option value="ACCEPTED">Accepté</option>
            <option value="DECLINED">Refusé</option>
          </select>
        </label>
      </div>
      <p>
        Les montants du devis se renseignent dans les prix TTC du poste. Saisissez ici uniquement
        les paiements effectués, sans compter deux fois un acompte et sa facture finale.
      </p>
      {expenses.map((expense, index) => (
        <fieldset key={expense.id}>
          <legend>Paiement {index + 1}</legend>
          <div className="form-grid">
            <label>
              Libellé du paiement
              <input
                required
                maxLength={150}
                value={expense.label}
                onChange={(event) => edit(expense.id, { label: event.target.value })}
              />
            </label>
            <label>
              Montant payé TTC (€)
              <input
                required
                type="number"
                min={0}
                max={1e8}
                step="0.01"
                value={Number.isFinite(expense.amount) ? expense.amount : ''}
                onChange={(event) =>
                  edit(expense.id, {
                    amount: event.target.value === '' ? NaN : Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Date du paiement
              <input
                required
                type="date"
                value={expense.date}
                onChange={(event) => edit(expense.id, { date: event.target.value })}
              />
            </label>
            <label>
              Référence facture / paiement
              <input
                maxLength={150}
                value={expense.reference}
                onChange={(event) => edit(expense.id, { reference: event.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            className="button"
            onClick={() =>
              change({ expenses: expenses.filter((value) => value.id !== expense.id) })
            }
          >
            Retirer ce paiement du brouillon
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button"
        disabled={expenses.length >= 100}
        onClick={() =>
          change({
            expenses: [
              ...expenses,
              {
                id: crypto.randomUUID(),
                label: '',
                amount: 0,
                date: new Date().toLocaleDateString('en-CA'),
                reference: '',
              },
            ],
          })
        }
      >
        Ajouter un paiement
      </button>
      <label>
        <input
          type="checkbox"
          checked={item.actualFinal ?? false}
          onChange={(event) => change({ actualFinal: event.target.checked })}
        />{' '}
        Poste soldé : tous les paiements sont saisis
      </label>
      <p className="muted">Enregistrez le scénario pour conserver les devis et paiements.</p>
    </details>
  );
}

export function SpendingSummary({
  input,
  investment,
}: {
  input: RenovationInput;
  investment: Investment;
}) {
  if (
    input.items.some((item) =>
      (item.expenses ?? []).some((expense) => !expenseSchema.safeParse(expense).success),
    )
  )
    return (
      <section className="spending-summary">
        <h4>Suivi prévu / dépensé</h4>
        <p>Complétez les libellés, dates et montants des paiements pour calculer le suivi.</p>
      </section>
    );
  const spending = renovationSpending(input),
    actual = compareActualRenovation(investment, input);
  return (
    <section className="spending-summary">
      <h4>Suivi prévu / dépensé</h4>
      <p>
        Paiements saisis : <strong>{euro(spending.paid)}</strong> · Budget prévu avec imprévus :{' '}
        {spending.planned === null ? 'À compléter' : euro(spending.planned)}
      </p>
      <p>
        {spending.remaining === null
          ? 'Écart indisponible : budget incomplet.'
          : spending.remaining < 0
            ? `Dépassement du budget : ${euro(-spending.remaining)}`
            : `Budget non consommé : ${euro(spending.remaining)}`}
      </p>
      <p className="muted">
        Le budget non consommé ne représente pas les factures restant à payer. Les paiements ne
        modifient pas automatiquement l’analyse principale.
      </p>
      {actual ? (
        <p>
          Coût final déclaré, tous les postes soldés : cash-flow avant impôt{' '}
          {euro(actual.cashFlowMonthly)}/mois · rendement net {pct(actual.netYield)}. Calcul avec
          les coûts payés, sans nouvelle provision pour imprévus.
        </p>
      ) : (
        <p>
          {spending.final
            ? 'Vérifiez les hypothèses de financement pour calculer la rentabilité finale.'
            : 'Soldez chaque poste une fois tous ses paiements saisis pour calculer la rentabilité sur les coûts finaux.'}
        </p>
      )}
    </section>
  );
}
