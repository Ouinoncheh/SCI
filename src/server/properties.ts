import { db } from './db';
import { analyze, investmentSchema, type Investment } from '../financial-engine';
import { membership, HttpError } from './security';
import { propertySchema, propertyPatchSchema } from './validation';
import type { DemoProperty } from '../data/demo';
import type { Prisma } from '@prisma/client';
import { listingAttachmentSchema } from '../listing-providers/import-types';
import { propertyValuesSchema, type NormalizedProperty } from '../listing-providers/normalized';

function analysisData(v: Investment) {
  const { loan: _loan, ...results } = analyze(v);
  void _loan;
  return {
    engineVersion: '0.1.0',
    inputs: v as Prisma.InputJsonValue,
    results: results as Prisma.InputJsonValue,
  };
}
export async function listProperties(userId: string, sciId: string): Promise<DemoProperty[]> {
  const member = await membership(userId, sciId);
  const rows = await db.property.findMany({
    where: { sciId },
    orderBy: { createdAt: 'desc' },
    include: {
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
      watchlists: { where: { memberId: member.id } },
      listings: { orderBy: { importedAt: 'desc' }, take: 1 },
      roomsGallery: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        select: {
          photos: {
            take: 1,
            orderBy: [{ isCover: 'desc' }, { uploadedAt: 'asc' }],
            select: { id: true },
          },
        },
      },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    city: p.city,
    district: p.address ?? 'Adresse non renseignée',
    address: p.address,
    importData: (() => {
      const stored = p.listings[0]?.normalizedData as Record<string, unknown> | undefined;
      return stored?.provenance && stored?.enrichment
        ? ({
            normalized: stored.provenance,
            enrichment: stored.enrichment,
          } as DemoProperty['importData'])
        : undefined;
    })(),
    listing: listingAttachmentSchema.safeParse(
      p.listings[0]?.normalizedData &&
        Object.fromEntries(
          Object.entries(p.listings[0].normalizedData as Record<string, unknown>).filter(
            ([key]) => key in listingAttachmentSchema.shape,
          ),
        ),
    ).data,
    photoUrl: p.roomsGallery[0]?.photos[0]
      ? `/api/workspace/scis/${sciId}/properties/${p.id}/photos/${p.roomsGallery[0].photos[0].id}`
      : undefined,
    postcode: p.postcode,
    rooms: p.rooms ?? 0,
    dpe: p.dpe ?? '?',
    status: p.status,
    favorite: p.watchlists.length > 0,
    color: 'sage',
    description: p.description ?? '',
    version: p.version,
    investment: investmentSchema.parse(p.analyses[0]?.inputs),
  }));
}
export async function createProperty(userId: string, sciId: string, raw: unknown) {
  await membership(userId, sciId, 'write');
  const input = propertySchema.parse(raw);
  return db.$transaction(async (tx) => {
    const draftId = input.listing?.draftId;
    if (draftId)
      await tx.$queryRaw`SELECT id FROM "PropertyImportDraft" WHERE id = ${draftId} AND "sciId" = ${sciId} FOR UPDATE`;
    const draft = draftId
      ? await tx.propertyImportDraft.findFirst({
          where: { id: draftId, sciId, status: { not: 'CONVERTED' } },
          include: { assets: { where: { kind: 'photo' } } },
        })
      : null;
    if (draftId && !draft) throw new HttpError(409, 'Brouillon introuvable ou déjà enregistré.');
    const normalized = draft
      ? propertyValuesSchema.parse(
          Object.fromEntries(
            Object.entries(draft.normalized as unknown as NormalizedProperty).filter(
              ([key]) => key in propertyValuesSchema.shape,
            ),
          ),
        )
      : undefined;
    const p = await tx.property.create({
      data: {
        sciId,
        title: input.title,
        city: input.city,
        postcode: input.postcode,
        rooms: input.rooms || null,
        dpe: input.dpe === '?' ? null : input.dpe,
        description: input.description,
        address: input.address || null,
        ...(input.listing
          ? {
              photos: input.listing.photos,
              listings: {
                create: {
                  url: input.listing.sourceUrl,
                  platform: new URL(input.listing.sourceUrl).hostname,
                  normalizedData: {
                    ...input.listing,
                    photos: input.listing.photos,
                    ...(normalized ? { normalized } : {}),
                    ...(draft
                      ? { provenance: draft.normalized, enrichment: draft.enrichment }
                      : {}),
                  },
                  photoRights: 'Autorisation de réutilisation déclarée par le membre',
                },
              },
            }
          : {}),
        type: normalized?.propertyType ?? 'OTHER',
        bedrooms: normalized?.bedrooms,
        floor: normalized?.floor,
        elevator: normalized?.elevator,
        balcony: normalized?.balcony,
        terrace: normalized?.terrace,
        parking: normalized?.parking,
        garage: normalized?.garage,
        cellar: normalized?.cellar,
        ges: normalized?.ges,
        latitude: normalized?.latitude,
        longitude: normalized?.longitude,
        price: input.investment.price,
        area: input.investment.area,
        analyses: { create: analysisData(input.investment) },
      },
    });
    if (draft) {
      await tx.propertyImportDraft.update({
        where: { id: draft.id },
        data: { status: 'CONVERTED', convertedPropertyId: p.id, version: { increment: 1 } },
      });
      if (draft.assets.length) {
        const room = await tx.propertyRoom.create({
          data: {
            sciId,
            propertyId: p.id,
            name: 'Photos de l’annonce',
            roomType: 'Autre',
            notes: 'Photos fournies pendant l’import',
          },
        });
        for (const [i, asset] of draft.assets.entries())
          if (
            (asset.medium || asset.mediumPath) &&
            (asset.thumbnail || asset.thumbnailPath) &&
            asset.width &&
            asset.height
          )
            await tx.roomPhoto.create({
              data: {
                sciId,
                propertyId: p.id,
                roomId: room.id,
                image: asset.medium,
                thumbnail: asset.thumbnail,
                imagePath: asset.mediumPath,
                thumbnailPath: asset.thumbnailPath,
                width: asset.width,
                height: asset.height,
                originalFilename: asset.originalFilename,
                uploadedBy: userId,
                isCover: i === 0,
                angleLabel: '',
                comment: 'Import utilisateur',
              },
            });
      }
    }
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        action: 'PROPERTY_CREATED',
        entityId: p.id,
        metadata: { version: p.version },
      },
    });
    return p.id;
  });
}
export async function updateProperty(userId: string, sciId: string, id: string, raw: unknown) {
  await membership(userId, sciId, 'write');
  const input = propertyPatchSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const property = await tx.property.findFirst({ where: { sciId, id } });
    if (!property) throw new HttpError(404, 'Bien introuvable.');
    const changed = await tx.property.updateMany({
      where: { sciId, id, version: input.version },
      data: {
        version: { increment: 1 },
        status: input.status,
        ...(input.details
          ? {
              ...input.details,
              address: input.details.address || null,
              rooms: input.details.rooms || null,
              dpe: input.details.dpe === '?' ? null : input.details.dpe,
            }
          : {}),
        ...(input.investment ? { price: input.investment.price, area: input.investment.area } : {}),
      },
    });
    if (!changed.count)
      throw new HttpError(
        409,
        'Ce bien a été modifié par un autre membre. Rechargez la page avant de réessayer.',
      );
    if (input.investment)
      await tx.propertyAnalysis.create({
        data: { sciId, propertyId: id, ...analysisData(input.investment) },
      });
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        entityId: id,
        action: input.investment
          ? 'ANALYSIS_SAVED'
          : input.details
            ? 'PROPERTY_UPDATED'
            : 'STATUS_CHANGED',
        metadata: { previousVersion: input.version, status: input.status ?? property.status },
      },
    });
  });
}
export async function setFavorite(
  userId: string,
  sciId: string,
  propertyId: string,
  favorite: boolean,
) {
  const member = await membership(userId, sciId);
  if (!(await db.property.findFirst({ where: { sciId, id: propertyId }, select: { id: true } })))
    throw new HttpError(404, 'Bien introuvable.');
  if (favorite)
    await db.watchlist.upsert({
      where: { sciId_propertyId_memberId: { sciId, propertyId, memberId: member.id } },
      create: { sciId, propertyId, memberId: member.id },
      update: {},
    });
  else await db.watchlist.deleteMany({ where: { sciId, propertyId, memberId: member.id } });
}
