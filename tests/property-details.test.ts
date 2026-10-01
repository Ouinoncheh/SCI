import { describe, expect, it } from 'vitest';
import { propertyDetailsSchema } from '../src/property-details';
import { propertyPatchSchema } from '../src/server/validation';

const details = {
  title: 'Appartement',
  city: 'Nantes',
  postcode: '44000',
  address: '',
  rooms: 0,
  dpe: '?',
  description: '',
};
describe('correction des caractéristiques', () => {
  it('conserve les informations inconnues sans inventer une adresse ou un DPE', () => {
    expect(propertyDetailsSchema.parse(details)).toEqual(details);
  });
  it('rejette les valeurs invalides et les champs protégés', () => {
    for (const extra of [
      { postcode: '4400' },
      { rooms: 2.5 },
      { rooms: -1 },
      { dpe: 'H' },
      { title: ' ' },
      { address: 'x'.repeat(301) },
      { sciId: 'autre' },
    ]) {
      expect(propertyDetailsSchema.safeParse({ ...details, ...extra }).success).toBe(false);
    }
  });
  it('exige une version et une seule catégorie de modification', () => {
    expect(propertyPatchSchema.safeParse({ version: 1, details }).success).toBe(true);
    for (const input of [{ details }, { version: 1 }, { version: 1, details, status: 'NEW' }]) {
      expect(propertyPatchSchema.safeParse(input).success).toBe(false);
    }
  });
});
