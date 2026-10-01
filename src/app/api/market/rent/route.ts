import { z } from 'zod';
import { findRentReference, selectCommune } from '@/server/rent-market';
import { arrondissementCode } from '@/market-data/rent-estimate';
export const dynamic = 'force-dynamic';
const input = z.object({
  postcode: z.string().regex(/^\d{5}$/),
  city: z.string().max(100).default(''),
  code: z
    .string()
    .regex(/^[0-9AB]{5}$/)
    .optional(),
  kind: z.enum(['HOUSE', 'APARTMENT', 'APARTMENT_SMALL', 'APARTMENT_LARGE']),
});
export async function GET(request: Request) {
  const params = input.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!params.success)
    return Response.json(
      { error: 'Renseignez un code postal et un type de logement valides.' },
      { status: 400 },
    );
  try {
    const district = arrondissementCode(params.data.postcode);
    if (district) {
      if (params.data.code && params.data.code !== district)
        return Response.json(
          { error: 'La commune ne correspond pas au code postal.' },
          { status: 400 },
        );
      const reference = await findRentReference(district, params.data.kind);
      return Response.json({
        reference,
        communes: [],
        message: reference ? null : 'Référence indisponible pour cet arrondissement.',
      });
    }
    const url = new URL('https://geo.api.gouv.fr/communes');
    url.searchParams.set('codePostal', params.data.postcode);
    url.searchParams.set('fields', 'nom,code');
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error('Geo unavailable');
    const communes = z
      .array(z.object({ nom: z.string(), code: z.string() }))
      .parse(await response.json());
    const selected = selectCommune(communes, params.data.city, params.data.code);
    const reference = selected ? await findRentReference(selected.code, params.data.kind) : null;
    return Response.json({
      reference,
      communes: communes.map((row) => ({ code: row.code, name: row.nom })),
      message: !communes.length
        ? 'Aucune commune trouvée pour ce code postal.'
        : !selected
          ? 'Sélectionnez la commune exacte du bien.'
          : !reference
            ? 'Données de loyers indisponibles pour cette commune.'
            : null,
    });
  } catch {
    return Response.json(
      {
        error:
          'La référence de loyer est temporairement indisponible. Vous pouvez saisir votre loyer manuellement.',
      },
      { status: 503 },
    );
  }
}
