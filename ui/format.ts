export const euro = (n: number | null, digits = 0) =>
  n === null
    ? 'Donnée indisponible'
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(n);
export const pct = (n: number | null) =>
  n === null
    ? 'Donnée indisponible'
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n) + ' %';
export const number = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);
