import { describe, expect, it } from 'vitest';
import {
  arrondissementCode,
  normalizeCommuneName,
  rentHypotheses,
  rentReference,
} from '../src/market-data/rent-estimate';
import { findRentReference, selectCommune } from '../src/server/rent-market';
import { analyze } from '../src/financial-engine';
import { properties } from '../src/data/demo';

describe('Local rental reference and monthly analysis', () => {
  const reference = rentReference('13081', 'Rognac', 'APARTMENT', [
    15,
    10,
    20,
    'commune',
    100,
    0.8,
  ]);
  it('deducts recoverable charges before calculating rent excluding charges', () => {
    const hypotheses = rentHypotheses(60, reference, 100)!;
    expect(hypotheses.map((h) => h.monthlyRent)).toEqual([710, 800, 890]);
    const base = properties[0].investment;
    const central = analyze({ ...base, monthlyRent: hypotheses[1].monthlyRent! });
    expect(central.cashFlowMonthly).toBeCloseTo(central.cashFlowAnnual / 12);
    expect(analyze({ ...base, monthlyRent: 890 }).cashFlowMonthly).toBeGreaterThan(
      central.cashFlowMonthly,
    );
  });
  it('does not invent charges or silently clamp impossible rent', () => {
    expect(rentHypotheses(NaN, reference, 0)).toBeNull();
    expect(rentHypotheses(60, reference, NaN)).toBeNull();
    expect(rentHypotheses(60, reference, -1)).toBeNull();
    expect(rentHypotheses(60, reference, 1000)!.map((h) => h.monthlyRent)).toEqual([
      null,
      null,
      null,
    ]);
  });
  it('flags weak or pooled estimates', () => {
    expect(reference.lowConfidence).toBe(false);
    expect(rentReference('x', 'x', 'HOUSE', [10, null, null, 'maille', 0, 0.9]).lowConfidence).toBe(
      true,
    );
  });
  it('requires an exact town or explicit selection, never the first postcode match', () => {
    const rows = [
      { code: '1', nom: 'Rognac' },
      { code: '2', nom: 'Autre' },
    ];
    expect(selectCommune(rows, '')).toBeNull();
    expect(selectCommune(rows, 'Rognac 13340')?.code).toBe('1');
    expect(selectCommune(rows, '', 'foreign')).toBeNull();
    expect(normalizeCommuneName('L’Étrat')).toBe(normalizeCommuneName("L'Etrat 42580"));
  });
  it('resolves municipal arrondissements without confusing nearby communes', () => {
    expect(arrondissementCode('13006')).toBe('13206');
    expect(arrondissementCode('75020')).toBe('75120');
    expect(arrondissementCode('69009')).toBe('69389');
    expect(arrondissementCode('13340')).toBeNull();
    expect(arrondissementCode('13020')).toBeNull();
  });
  it('reads real ANIL reference data for Rognac and Marseille, and returns null for absent data', async () => {
    expect((await findRentReference('13081', 'HOUSE'))?.perSquareMeter).toBeCloseTo(14.579);
    expect((await findRentReference('13206', 'APARTMENT_SMALL'))?.perSquareMeter).toBeGreaterThan(
      0,
    );
    expect(await findRentReference('xxxxx', 'HOUSE')).toBeNull();
  });
});
