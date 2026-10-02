'use client';
import type { Investment } from '@/financial-engine';
export const fieldGroups: { name: string; fields: [Exclude<keyof Investment, 'rentPending'>, string, string][] }[] = [
  {
    name: 'Acquisition & travaux',
    fields: [
      ['price', 'Prix d’achat', '€'],
      ['area', 'Surface', 'm²'],
      ['acquisitionRate', 'Frais d’acquisition', '% du prix'],
      ['agencyFees', 'Agence non incluse dans le prix', '€'],
      ['works', 'Budget travaux', '€'],
      ['contingencyRate', 'Marge travaux', '%'],
      ['furniture', 'Mobilier', '€'],
      ['bankFees', 'Frais bancaires', '€'],
      ['guaranteeFees', 'Garantie', '€'],
      ['brokerFees', 'Courtage', '€'],
      ['otherFees', 'Autres frais d’achat', '€'],
    ],
  },
  {
    name: 'Financement',
    fields: [
      ['contribution', 'Apport personnel', '€'],
      ['loanRate', 'Taux nominal annuel', '%'],
      ['loanYears', 'Durée du prêt', 'ans'],
      ['insuranceRate', 'Assurance sur capital initial', '% / an'],
    ],
  },
  {
    name: 'Location & charges annuelles',
    fields: [
      ['monthlyRent', 'Loyer mensuel hors charges', '€ / mois'],
      ['vacancyRate', 'Vacance locative', '%'],
      ['propertyTax', 'Taxe foncière nette récupérations', '€ / an'],
      ['condoCharges', 'Copropriété non récupérable', '€ / an'],
      ['pno', 'Assurance PNO', '€ / an'],
      ['accounting', 'Comptabilité', '€ / an'],
      ['maintenance', 'Entretien & maintenance', '€ / an'],
      ['otherExpenses', 'Autres charges', '€ / an'],
      ['managementRate', 'Gestion locative', '% encaissé'],
      ['gliRate', 'Garantie loyers impayés', '% encaissé'],
      ['reserveRate', 'Provision travaux', '% encaissé'],
    ],
  },
];
export function InvestmentFields({
  value,
  onChange,
  groups = fieldGroups,
}: {
  value: Investment;
  onChange: (v: Investment) => void;
  groups?: typeof fieldGroups;
}) {
  return (
    <>
      {groups.map((group) => (
        <fieldset className="field-section" key={group.name}>
          <legend>{group.name}</legend>
          <div className="form-grid">
            {group.fields.map(([key, label, unit]) => (
              <label key={key}>
                {label}
                <div className="number-input">
                  <input
                    type="number"
                    required={key !== 'monthlyRent'}
                    min={key === 'price' || key === 'area' ? 0.01 : key === 'loanYears' ? 1 : 0}
                    max={key === 'loanYears' ? 40 : undefined}
                    step={key === 'loanYears' ? 1 : 'any'}
                    value={Number.isNaN(value[key]) || (key === 'monthlyRent' && value.rentPending) ? '' : value[key] as number}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        [key]: e.target.value === '' ? NaN : Number(e.target.value),
                        ...(key === 'monthlyRent' ? { rentPending: e.target.value === '' } : {}),
                      })
                    }
                  />
                  <span>{unit}</span>
                </div>
                {key === 'monthlyRent' && <small>Facultatif à l’achat. Vous pourrez estimer ce loyer selon la commune et la surface.</small>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </>
  );
}
