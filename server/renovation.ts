import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from './db';
import { HttpError } from './security';
import { roomAccess } from './rooms';
import { renovationSchema, type RenovationInput } from '../renovation';
const patchSchema = z
  .object({
    version: z.number().int().positive(),
    data: renovationSchema.optional(),
    favorite: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => [v.data, v.favorite, v.archived].filter((x) => x !== undefined).length === 1);
async function validateRooms(sciId: string, propertyId: string, data: RenovationInput) {
  const ids = [...new Set(data.items.flatMap((r) => (r.roomId ? [r.roomId] : [])))];
  if (
    ids.length &&
    (await db.propertyRoom.count({ where: { sciId, propertyId, id: { in: ids } } })) !== ids.length
  )
    throw new HttpError(400, 'Une pièce ne fait pas partie de ce bien.');
}
export async function listRenovationScenarios(userId: string, sciId: string, propertyId: string) {
  await roomAccess(userId, sciId, propertyId);
  const rows = await db.renovationScenario.findMany({
    where: { sciId, propertyId, archived: false },
    orderBy: [{ favorite: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map((r) => ({
    ...renovationSchema.parse(r.data),
    id: r.id,
    version: r.version,
    favorite: r.favorite,
    updatedAt: r.updatedAt.toISOString(),
  }));
}
export async function saveRenovationScenario(
  userId: string,
  sciId: string,
  propertyId: string,
  raw: unknown,
  id?: string,
) {
  await roomAccess(userId, sciId, propertyId, true);
  const patch = id ? patchSchema.parse(raw) : null;
  const data = id ? patch?.data : renovationSchema.parse(raw);
  if (data) await validateRooms(sciId, propertyId, data);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId} AND "sciId" = ${sciId} FOR UPDATE`;
    let scenarioId: string;
    if (id && patch) {
      const current = await tx.renovationScenario.findFirst({
        where: { id, sciId, propertyId, archived: false },
      });
      if (!current) throw new HttpError(404, 'Scénario introuvable.');
      if (current.version !== patch.version)
        throw new HttpError(409, 'Le scénario a changé. Rechargez-le.');
      if (patch.favorite)
        await tx.renovationScenario.updateMany({
          where: { sciId, propertyId, favorite: true, id: { not: id } },
          data: { favorite: false, version: { increment: 1 } },
        });
      await tx.renovationScenario.update({
        where: { id },
        data: {
          ...(data ? { data: data as Prisma.InputJsonValue } : {}),
          favorite: patch.archived ? false : patch.favorite,
          archived: patch.archived,
          version: { increment: 1 },
        },
      });
      scenarioId = id;
    } else {
      if (
        (await tx.renovationScenario.count({ where: { sciId, propertyId, archived: false } })) >= 20
      )
        throw new HttpError(409, 'Limite de 20 scénarios actifs par bien.');
      const created = await tx.renovationScenario.create({
        data: { sciId, propertyId, data: data as Prisma.InputJsonValue, createdBy: userId },
      });
      scenarioId = created.id;
    }
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        entityId: propertyId,
        action: patch?.archived
          ? 'RENOVATION_ARCHIVED'
          : patch?.favorite
            ? 'RENOVATION_PREFERRED'
            : 'RENOVATION_SAVED',
        metadata: { scenarioId },
      },
    });
    return scenarioId;
  });
}
