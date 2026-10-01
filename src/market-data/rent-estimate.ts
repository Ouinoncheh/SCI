export const RENT_SOURCE =
  'Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin';
export const RENT_SOURCE_URL =
  'https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025';
export type RentKind = 'HOUSE' | 'APARTMENT' | 'APARTMENT_SMALL' | 'APARTMENT_LARGE';
export type RentIndicator = [
  number,
  number | null,
  number | null,
  string,
  number | null,
  number | null,
];
export type RentReference = {
  code: string;
  name: string;
  kind: RentKind;
  perSquareMeter: number;
  lower: number | null;
  upper: number | null;
  scale: string;
  observations: number | null;
  rSquared: number | null;
  lowConfidence: boolean;
  referenceArea: number;
  period: string;
  source: string;
  sourceUrl: string;
};
export function rentReference(
  code: string,
  name: string,
  kind: RentKind,
  row: RentIndicator,
): RentReference {
  return {
    code,
    name,
    kind,
    perSquareMeter: row[0],
    lower: row[1],
    upper: row[2],
    scale: row[3],
    observations: row[4],
    rSquared: row[5],
    lowConfidence:
      row[3] !== 'commune' || row[4] === null || row[4] < 30 || row[5] === null || row[5] < 0.5,
    referenceArea:
      kind === 'HOUSE'
        ? 92
        : kind === 'APARTMENT_SMALL'
          ? 37
          : kind === 'APARTMENT_LARGE'
            ? 72
            : 52,
    period: 'T3 2025',
    source: RENT_SOURCE,
    sourceUrl: RENT_SOURCE_URL,
  };
}
/** These are user scenarios, not official quantiles or confidence intervals. */
export function rentHypotheses(area: number, reference: RentReference, recoverableCharges: number) {
  if (
    !Number.isFinite(area) ||
    area <= 0 ||
    !Number.isFinite(recoverableCharges) ||
    recoverableCharges < 0
  )
    return null;
  return (
    [
      ['Prudent (−10 %)', 0.9],
      ['Central', 1],
      ['Optimiste (+10 %)', 1.1],
    ] as const
  ).map(([label, factor]) => {
    const includingCharges = Math.round(area * reference.perSquareMeter * factor * 100) / 100;
    return {
      label,
      includingCharges,
      monthlyRent:
        includingCharges >= recoverableCharges
          ? Math.round((includingCharges - recoverableCharges) * 100) / 100
          : null,
    };
  });
}
export function normalizeCommuneName(value: string) {
  return value
    .replace(/\b\d{5}\b/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** The ANIL dataset uses municipal arrondissements for these three cities. */
export function arrondissementCode(postcode: string): string | null {
  if (
    /^750\d{2}$/.test(postcode) &&
    Number(postcode.slice(3)) >= 1 &&
    Number(postcode.slice(3)) <= 20
  )
    return `751${postcode.slice(3)}`;
  if (postcode === '75116') return '75116';
  if (/^6900[1-9]$/.test(postcode)) return `6938${postcode.slice(-1)}`;
  if (
    /^130\d{2}$/.test(postcode) &&
    Number(postcode.slice(3)) >= 1 &&
    Number(postcode.slice(3)) <= 16
  )
    return `132${postcode.slice(3)}`;
  return null;
}
