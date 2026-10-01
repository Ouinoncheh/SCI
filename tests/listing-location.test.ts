import { expect, it } from 'vitest';
import { extractListingText } from '../src/listing-providers/text';
import { UserTextProvider } from '../src/listing-providers';
const text = `calme absolu centre ville à pied
Prix : 170000 €.
Sur ce terrain de 253 m² à ROGNAC, VILLAS PRISME vous propose de réaliser votre projet de construction de maison individuelle.
Demandez une étude gratuite et personnalisée de votre projet de construction sur ce terrain à ROGNAC !
Contactez Stevens LAUTHE au O6 48 07 36 53 (Villas Prisme - Show-room de Vitrolles).
Référence annonce : TESL008563E1BB5902`;
it('localise le terrain à Rognac plutôt que le showroom à Vitrolles, sans inventer un code postal', () => {
  expect(extractListingText(text)).toMatchObject({
    city: 'ROGNAC',
    postalCode: null,
    price: 170000,
    surface: 253,
    propertyType: 'LAND',
  });
  expect(new UserTextProvider().normalizeListing(text)).toMatchObject({
    city: 'ROGNAC',
    postcode: null,
  });
});
it('refuse de choisir entre plusieurs communes pour le bien', () => {
  expect(extractListingText('Terrain à ROGNAC. Terrain à VITROLLES.').city).toBeNull();
});
