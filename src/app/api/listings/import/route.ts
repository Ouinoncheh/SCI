import { z } from 'zod';
import { importDraft, importRequestSchema } from '@/server/import-drafts';
import { checkOrigin, errorResponse, jsonBody, rateLimit, requireUser } from '@/server/security';
import { createProperty } from '@/server/properties';
import { propertySchema } from '@/server/validation';
import type { NormalizedProperty } from '@/listing-providers/normalized';
import { analyzeImport } from '@/listing-providers/analysis';

const requestSchema = z
  .object({
    ...importRequestSchema.innerType().shape,
    sciId: z.string().min(1).max(100),
    property: propertySchema.omit({ listing: true }).optional(),
    photoRights: z.boolean().optional(),
  })
  .strict();
/** Explicit SCI required: never infer access from a user-supplied URL. */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(request.headers);
    await rateLimit(`listing-import:${user.id}`, 10);
    const { sciId, property, photoRights, ...input } = requestSchema.parse(
      await jsonBody(request, 2_100_000),
    );
    const draft = await importDraft(user.id, sciId, input);
    const normalized = draft.normalized as unknown as NormalizedProperty;
    // Financial inputs must be explicitly supplied. Missing listing fields stay in a draft.
    if (
      !property ||
      normalized.price === null ||
      normalized.price <= 0 ||
      normalized.surface === null ||
      draft.status === 'NEEDS_MANUAL_IMPORT'
    )
      return Response.json(
        {
          success: true,
          property: null,
          draft,
          analysis: null,
          status: normalized.importStatus ?? 'PARTIAL',
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    const investment = {
      ...property.investment,
      price: normalized.price,
      area: normalized.surface,
    };
    const id = await createProperty(user.id, sciId, {
      ...property,
      investment,
      title: normalized.title ?? property.title,
      city: normalized.city ?? property.city,
      postcode: normalized.postalCode ?? property.postcode,
      description: normalized.description ?? property.description,
      rooms: normalized.rooms ?? property.rooms,
      dpe: normalized.dpe ?? property.dpe,
      address: normalized.address ?? property.address,
      listing: {
        sourceUrl: input.url,
        method: 'url',
        draftId: draft.id,
        photos: photoRights ? normalized.images : [],
        photoRights: true,
      },
    });
    return Response.json(
      {
        success: true,
        property: { id },
        draft: { ...draft, status: 'CONVERTED' },
        analysis: analyzeImport(investment, normalized.dpe),
        status: 'IMPORTED',
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
