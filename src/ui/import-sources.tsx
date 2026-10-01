import type { DemoProperty } from '../data/demo';
import { fieldLabels } from '../listing-providers/normalized';
export function ImportSources({ data }: { data: NonNullable<DemoProperty['importData']> }) {
  return (
    <section className="panel">
      <h3>D’où vient cette donnée ?</h3>
      <p>
        Les valeurs ci-dessous décrivent l’import initial. Vos hypothèses financières et corrections
        du bien sont enregistrées séparément.
      </p>
      {Object.entries(data.normalized.confidence).map(
        ([key, evidence]) =>
          evidence && (
            <details key={key}>
              <summary>
                {fieldLabels[key as keyof typeof fieldLabels]} :{' '}
                {Array.isArray(evidence.value) ? 'Images référencées' : String(evidence.value)}
              </summary>
              <p>
                {evidence.source} · confiance {Math.round(evidence.confidence * 100)} % ·{' '}
                {evidence.retrievedAt} ·{' '}
                <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Source
                </a>
              </p>
            </details>
          ),
      )}
      <p>
        {data.enrichment.market
          ? `DVF : ${data.enrichment.market.count} comparables · médiane ${data.enrichment.market.median.toFixed(0)} €/m²`
          : 'Prix du secteur : donnée indisponible.'}
      </p>
      {data.enrichment.warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
    </section>
  );
}
