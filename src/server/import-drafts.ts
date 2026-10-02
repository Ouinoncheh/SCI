import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from './db';
import { membership, HttpError } from './security';
import { fetchListingHtml } from './listing-fetch';
import { ListingImporter, StructuredHtmlProvider } from '../listing-providers/importer';
import {
  propertyValuesSchema,
  PropertyNormalizer,
  type NormalizedProperty,
} from '../listing-providers/normalized';
import { webUrl } from '../listing-providers/import-types';
import { PropertyEnrichmentService } from '../market-data/enrichment';
import { FrenchPublicDataProvider } from './public-data';
import { LeboncoinProvider } from '../listing-providers/leboncoin';
import { getLeboncoinAd } from './leboncoin-service';
import { safeLogUrl } from './import-log';
export const importRequestSchema = z
  .object({
    url: webUrl,
    html: z.string().max(2_000_000).optional(),
    text: z.string().max(20000).optional(),
    draftId: z.string().min(1).max(100).optional(),
    version: z.number().int().positive().optional(),
    corrected: propertyValuesSchema.optional(),
  })
  .strict()
  .refine(
    (input) => [input.html, input.text, input.corrected].filter((v) => v !== undefined).length <= 1,
    'Choisissez un seul contenu à analyser.',
  );
export const importer = new ListingImporter(
  new StructuredHtmlProvider(fetchListingHtml),
  new LeboncoinProvider(getLeboncoinAd),
);
export async function importDraft(
  userId: string,
  sciId: string,
  raw: unknown,
  evidenceSource?: string,
) {
  await membership(userId, sciId, 'write');
  const input = importRequestSchema.parse(raw);
  const started = Date.now();
  const previous = input.draftId
    ? await db.propertyImportDraft.findFirst({ where: { id: input.draftId, sciId } })
    : null;
  if (input.draftId && !previous) throw new HttpError(404, 'Brouillon introuvable.');
  if (previous?.status === 'CONVERTED')
    throw new HttpError(409, 'Brouillon déjà enregistré comme bien.');
  if (previous && input.version !== previous.version)
    throw new HttpError(409, 'Ce brouillon a changé. Rechargez-le avant de réessayer.');
  const result = input.corrected
    ? {
        normalized: new PropertyNormalizer().normalize(
          input.url,
          input.corrected,
          'USER_CONFIRMED',
          1,
        ),
        status: 'READY',
        message: null,
      }
    : await importer.import(input.url, { html: input.html, text: input.text });
  if (evidenceSource)
    for (const evidence of Object.values(result.normalized.confidence))
      if (evidence) {
        evidence.source = evidenceSource;
        if (evidenceSource === 'USER_PROVIDED_SCREENSHOT_OCR') evidence.confidence = 0.6;
      }
  if (previous && previous.sourceUrl === input.url) {
    const old = previous.normalized as unknown as NormalizedProperty;
    result.normalized.rawAttributes ??= old.rawAttributes;
    if (input.corrected && old.importStatus)
      result.normalized.importStatus =
        input.corrected.price !== null && input.corrected.surface !== null ? 'IMPORTED' : 'PARTIAL';
    for (const key of Object.keys(
      propertyValuesSchema.shape,
    ) as (keyof typeof propertyValuesSchema.shape)[]) {
      if (
        !input.corrected &&
        (result.normalized[key] === null || (key === 'images' && !result.normalized.images.length))
      ) {
        Object.assign(result.normalized, { [key]: old[key] });
        if (old.confidence[key]) result.normalized.confidence[key] = old.confidence[key];
      } else if (
        input.corrected &&
        JSON.stringify(result.normalized[key]) === JSON.stringify(old[key]) &&
        old.confidence[key]
      )
        result.normalized.confidence[key] = old.confidence[key];
    }
  }
  const enrichment = await new PropertyEnrichmentService(new FrenchPublicDataProvider())
    .enrich(result.normalized)
    .catch(() => ({
      geocoding: null,
      market: null,
      marketSource: null,
      dpeCandidates: [],
      warnings: [
        'Enrichissement public indisponible. Vous pouvez poursuivre avec les données de l’annonce.',
      ],
    }));
  if (enrichment.geocoding) {
    for (const key of ['latitude', 'longitude'] as const)
      if (result.normalized[key] === null) {
        result.normalized[key] = enrichment.geocoding[key];
        result.normalized.confidence[key] = {
          value: enrichment.geocoding[key],
          source: enrichment.geocoding.source,
          sourceUrl: enrichment.geocoding.sourceUrl,
          retrievedAt: enrichment.geocoding.retrievedAt,
          confidence: enrichment.geocoding.confidence,
        };
      }
  }
  const data = {
    normalized: result.normalized as unknown as Prisma.InputJsonValue,
    enrichment: enrichment as unknown as Prisma.InputJsonValue,
    status:
      result.status === 'NEEDS_MANUAL_IMPORT'
        ? 'NEEDS_MANUAL_IMPORT'
        : result.normalized.price !== null && result.normalized.surface !== null
          ? 'READY'
          : 'NEEDS_IMPORT_DATA',
    sourceUrl: input.url,
    source: result.normalized.source,
  };
  const draft = previous
    ? await db.$transaction(async (tx) => {
        const updated = await tx.propertyImportDraft.updateMany({
          where: { id: previous.id, sciId, version: input.version, status: { not: 'CONVERTED' } },
          data: { ...data, version: { increment: 1 } },
        });
        if (!updated.count)
          throw new HttpError(409, 'Ce brouillon a changé. Rechargez-le avant de réessayer.');
        return tx.propertyImportDraft.findUniqueOrThrow({ where: { id: previous.id } });
      })
    : await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "SCI" WHERE id = ${sciId} FOR UPDATE`;
        if (
          (await tx.propertyImportDraft.count({
            where: { sciId, status: { not: 'CONVERTED' } },
          })) >= 100
        )
          throw new HttpError(409, 'Limite de 100 brouillons actifs dans cette SCI.');
        return tx.propertyImportDraft.create({ data: { ...data, sciId, createdBy: userId } });
      });
  console.info(
    JSON.stringify({
      provider: result.normalized.source,
      listingId: result.normalized.sourceListingId,
      sourceUrl: safeLogUrl(input.url),
      operation: 'IMPORT',
      status: draft.status,
      errorCode: 'errorCode' in result ? result.errorCode : undefined,
      durationMs: Date.now() - started,
    }),
  );
  return {
    ...draft,
    message: result.message,
    errorCode: 'errorCode' in result ? result.errorCode : undefined,
  };
}
export async function draftAccess(userId: string, sciId: string, id: string, write = false) {
  await membership(userId, sciId, write ? 'write' : 'read');
  const draft = await db.propertyImportDraft.findFirst({
    where: { id, sciId },
    include: {
      assets: {
        select: { id: true, kind: true, originalFilename: true, width: true, height: true },
      },
    },
  });
  if (!draft) throw new HttpError(404, 'Brouillon introuvable.');
  return draft;
}
export async function recentDrafts(userId: string, sciId: string) {
  await membership(userId, sciId);
  return db.propertyImportDraft.findMany({
    where: { sciId, status: { not: 'CONVERTED' } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      sourceUrl: true,
      source: true,
      status: true,
      version: true,
      updatedAt: true,
    },
  });
}
export type DraftDto = {
  id: string;
  sourceUrl: string;
  status: string;
  version: number;
  normalized: NormalizedProperty;
  enrichment: Awaited<ReturnType<PropertyEnrichmentService['enrich']>>;
  message?: string | null;
};
