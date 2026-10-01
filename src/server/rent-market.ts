import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  normalizeCommuneName,
  rentReference,
  type RentIndicator,
  type RentKind,
} from '../market-data/rent-estimate';
type Dataset = Record<
  string,
  { name: string; indicators: Partial<Record<RentKind, RentIndicator>> }
>;
let data: Promise<Dataset> | undefined;
export async function findRentReference(code: string, kind: RentKind) {
  data ??= readFile(path.join(process.cwd(), 'src/market-data/data/rents-2025.json'), 'utf8')
    .then((raw) => JSON.parse(raw) as Dataset)
    .catch((error) => {
      data = undefined;
      throw error;
    });
  const entry = (await data)[code];
  const row = entry?.indicators[kind];
  return row ? rentReference(code, entry.name, kind, row) : null;
}
export function selectCommune<T extends { code: string; nom: string }>(
  rows: T[],
  city: string,
  code?: string,
) {
  if (code) return rows.find((row) => row.code === code) ?? null;
  const matches = rows.filter(
    (row) => normalizeCommuneName(row.nom) === normalizeCommuneName(city),
  );
  return matches.length === 1 ? matches[0] : null;
}
