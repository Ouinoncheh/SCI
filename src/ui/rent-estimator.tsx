'use client';
import { useState } from 'react';
import { analyze, investmentSchema, type Investment } from '@/financial-engine';
import { rentHypotheses, type RentKind, type RentReference } from '@/market-data/rent-estimate';
import { api } from './http';
import { euro, number, pct } from './format';
type Result = {
  reference: RentReference | null;
  communes: { code: string; name: string }[];
  message: string | null;
};
export function RentEstimator({
  city,
  postcode,
  rooms,
  investment,
  onChange,
  initialKind = '',
  disabled = false,
}: {
  city: string;
  postcode: string;
  rooms: number;
  investment: Investment;
  onChange: (v: Investment) => void;
  initialKind?: 'HOUSE' | 'APARTMENT' | '';
  disabled?: boolean;
}) {
  const [kind, setKind] = useState(initialKind);
  const [charges, setCharges] = useState('');
  const [loaded, setLoaded] = useState<{ key: string; result: Result }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = `${postcode}|${city}|${kind}|${rooms}`;
  const result = loaded?.key === key ? loaded.result : undefined;
  const hypotheses =
    result?.reference && charges.trim() !== ''
      ? rentHypotheses(investment.area, result.reference, Number(charges))
      : null;
  async function lookup(code?: string) {
    setBusy(true);
    setError('');
    const requestedKey = key;
    const dataKind: RentKind =
      kind === 'HOUSE'
        ? 'HOUSE'
        : rooms > 0 && rooms <= 2
          ? 'APARTMENT_SMALL'
          : rooms >= 3
            ? 'APARTMENT_LARGE'
            : 'APARTMENT';
    const query = new URLSearchParams({ postcode, city, kind: dataKind });
    if (code) query.set('code', code);
    try {
      setLoaded({ key: requestedKey, result: await api<Result>(`/api/market/rent?${query}`) });
    } catch (e) {
      setLoaded(undefined);
      setError(e instanceof Error ? e.message : 'Référence indisponible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset className="field-section" disabled={disabled}>
      <legend>Estimer le loyer et la trésorerie mensuelle</legend>
      <p>
        Référence locale de location vide. Sélectionnez le type de bien puis vérifiez le loyer
        proposé.
      </p>
        <div className="form-grid">
        <label>
          Type de logement
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="">Choisir un type</option>
            <option value="APARTMENT">Appartement</option>
            <option value="HOUSE">Maison</option>
          </select>
        </label>
        <label>
          Charges récupérables mensuelles estimées (€)
          <input
            type="number"
            min="0"
            step="any"
            value={charges}
            onChange={(e) => setCharges(e.target.value)}
            placeholder="À renseigner, même si 0 €"
          />
        </label>
      </div>
      <button
        type="button"
        className="button secondary"
        disabled={busy || !kind || !/^\d{5}$/.test(postcode)}
        aria-busy={busy}
        onClick={() => lookup()}
      >
        {busy ? 'Recherche des loyers…' : 'Rechercher le loyer local'}
      </button>
      {!/^\d{5}$/.test(postcode) && (
        <p className="micro">Renseignez le code postal du bien pour rechercher sa commune.</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result?.message && <p role="status">{result.message}</p>}
      {result && !result.reference && result.communes.length > 0 && (
        <label>
          Commune du bien
          <select
            value=""
            disabled={busy}
            onChange={(e) => {
              if (e.target.value) lookup(e.target.value);
            }}
          >
            <option value="">Sélectionner la commune</option>
            {result.communes.map((row) => (
              <option key={row.code} value={row.code}>
                {row.name} ({row.code})
              </option>
            ))}
          </select>
        </label>
      )}
      {result?.reference && (
        <>
          <p>
            <strong>
              {result.reference.name} · {number(result.reference.perSquareMeter)} €/m²/mois charges
              comprises
            </strong>{' '}
            · {result.reference.period}
          </p>
          <p className="micro">
            {result.reference.kind === 'HOUSE'
              ? 'Maison'
              : result.reference.kind === 'APARTMENT_SMALL'
                ? 'Appartement T1–T2'
                : result.reference.kind === 'APARTMENT_LARGE'
                  ? 'Appartement T3 et plus'
                  : 'Appartement'}{' '}
            type de {result.reference.referenceArea} m². La multiplication par votre surface est une
            approximation ; elle ne corrige pas le quartier, l’état ou le DPE et ne s’applique pas
            au meublé ou à la location saisonnière.
          </p>
          {result.reference.lowConfidence && (
            <p className="demo-notice">
              Référence à confirmer : peu d’observations, qualité statistique limitée ou estimation
              issue d’une maille regroupant plusieurs communes.
            </p>
          )}
          <p className="micro">
            Observations communales : {result.reference.observations ?? 'indisponible'}.{' '}
            {result.reference.lower !== null && result.reference.upper !== null
              ? `Intervalle de prédiction publié : ${number(result.reference.lower)} à ${number(result.reference.upper)} €/m² charges comprises.`
              : ''}
          </p>
          {!hypotheses && (
            <p>
              Renseignez la surface et les charges récupérables pour calculer le loyer hors charges.
            </p>
          )}
          {hypotheses && (
            <div className="rent-hypotheses">
              {hypotheses.map((h) => {
                const candidate =
                  h.monthlyRent !== null
                    ? investmentSchema.safeParse({ ...investment, monthlyRent: h.monthlyRent })
                    : null;
                const financial = candidate?.success ? analyze(candidate.data) : null;
                return (
                  <section className="panel" key={h.label}>
                    <h3>{h.label}</h3>
                    <p>
                      Loyer HC :{' '}
                      <strong>
                        {h.monthlyRent === null
                          ? 'Charges supérieures au loyer'
                          : euro(h.monthlyRent)}
                      </strong>
                    </p>
                    {financial ? (
                      <>
                        <p>
                          Trésorerie mensuelle avant impôt :{' '}
                          <strong
                            className={financial.cashFlowMonthly < 0 ? 'negative' : 'positive'}
                          >
                            {euro(financial.cashFlowMonthly)}
                          </strong>
                        </p>
                        <p>Rendement net annuel avant impôt : {pct(financial.netYield)}</p>
                      </>
                    ) : (
                      <p className="micro">
                        Complétez les hypothèses d’acquisition et de financement pour calculer la
                        trésorerie.
                      </p>
                    )}
                    <button
                      type="button"
                      className="button"
                      disabled={h.monthlyRent === null}
                      onClick={() => {
                        if (h.monthlyRent !== null)
                          onChange({ ...investment, monthlyRent: h.monthlyRent, rentPending: false });
                      }}
                    >
                      Utiliser ce loyer
                    </button>
                  </section>
                );
              })}
            </div>
          )}
          <p className="micro">
            Prudent et optimiste sont des scénarios de −10 % et +10 %, pas des prévisions ANIL. Les
            charges récupérables sont déduites de chaque loyer. Le calcul utilise vos charges non
            récupérables, votre vacance locative et votre crédit ; les postes à zéro restent à
            vérifier.
          </p>
          <p className="micro">
            <a href={result.reference.sourceUrl} target="_blank" rel="noreferrer">
              {result.reference.source}
            </a>
            . Sélectionner un loyer remplit le formulaire ; enregistrez ensuite le bien ou ses
            hypothèses pour conserver ce montant.
          </p>
        </>
      )}
    </fieldset>
  );
}
