import { z } from 'zod';
import { db } from './db';
import { roomAccess } from './rooms';
import { HttpError } from './security';
import { designSchema, projectionPrompt } from '../visualization/design';
import { designConfiguration } from './image-provider';
const generationSchema = z
  .object({
    requestKey: z.string().uuid(),
    variants: z.number().int().min(1).max(3),
    consent: z.literal(true),
  })
  .strict();
export async function listDesigns(userId: string, sciId: string, propertyId: string) {
  await roomAccess(userId, sciId, propertyId);
  const projects = await db.roomDesignProject.findMany({
    where: { sciId, propertyId, archived: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      roomId: true,
      photoId: true,
      scenarioId: true,
      style: true,
      renovationLevel: true,
      prompt: true,
      createdAt: true,
      visuals: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          status: true,
          variationLabel: true,
          provider: true,
          modelName: true,
          errorMessage: true,
          favorite: true,
          createdAt: true,
          completedAt: true,
        },
      },
    },
  });
  const today = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return {
    projects,
    configuration: designConfiguration(),
    usedToday: await db.generatedVisual.count({ where: { sciId, createdAt: { gte: today } } }),
  };
}
export async function createDesign(
  userId: string,
  sciId: string,
  propertyId: string,
  raw: unknown,
) {
  await roomAccess(userId, sciId, propertyId, true);
  const data = designSchema.parse(raw);
  const photo = await db.roomPhoto.findFirst({
    where: { id: data.photoId, sciId, propertyId },
    select: { roomId: true },
  });
  if (!photo) throw new HttpError(404, 'Photo introuvable dans ce bien.');
  if (
    data.scenarioId &&
    !(await db.renovationScenario.findFirst({
      where: { id: data.scenarioId, sciId, propertyId, archived: false },
    }))
  )
    throw new HttpError(400, 'Scénario travaux introuvable.');
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId} AND "sciId" = ${sciId} FOR UPDATE`;
    if ((await tx.roomDesignProject.count({ where: { sciId, propertyId, archived: false } })) >= 30)
      throw new HttpError(409, 'Limite de 30 projets visuels actifs par bien.');
    const project = await tx.roomDesignProject.create({
      data: { ...data, sciId, propertyId, roomId: photo.roomId, createdBy: userId },
    });
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        entityId: propertyId,
        action: 'DESIGN_PROJECT_CREATED',
        metadata: { projectId: project.id },
      },
    });
    return project.id;
  });
}
export async function queueDesign(
  userId: string,
  sciId: string,
  propertyId: string,
  projectId: string,
  raw: unknown,
) {
  await roomAccess(userId, sciId, propertyId, true);
  const input = generationSchema.parse(raw);
  const config = designConfiguration();
  if (!config.ready)
    throw new HttpError(
      503,
      'Génération IA non activée : configurez le fournisseur côté serveur. Le projet reste conservé.',
    );
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SCI" WHERE id = ${sciId} FOR UPDATE`;
    const project = await tx.roomDesignProject.findFirst({
      where: { id: projectId, sciId, propertyId, archived: false },
    });
    if (!project) throw new HttpError(404, 'Projet introuvable.');
    const existing = await tx.generatedVisual.findMany({
      where: { sciId, requestKey: input.requestKey },
      select: { id: true, projectId: true },
    });
    if (existing.length) {
      if (existing.some((r) => r.projectId !== projectId))
        throw new HttpError(409, 'Cette demande existe déjà.');
      return existing.map((r) => r.id);
    }
    const today = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (
      (await tx.generatedVisual.count({ where: { sciId, createdAt: { gte: today } } })) +
        input.variants >
      config.dailyLimit
    )
      throw new HttpError(429, 'Quota de 10 variantes par SCI sur 24 heures atteint.');
    if (
      (await tx.generatedVisual.count({
        where: { sciId, status: { in: ['PENDING', 'PROCESSING'] } },
      })) +
        input.variants >
      3
    )
      throw new HttpError(
        409,
        'Trois générations au maximum peuvent être en attente dans votre SCI.',
      );
    const ids: string[] = [];
    for (let i = 0; i < input.variants; i++) {
      const row = await tx.generatedVisual.create({
        data: {
          sciId,
          propertyId,
          projectId,
          requestKey: input.requestKey,
          variationLabel: `Variante ${String.fromCharCode(65 + i)}`,
          provider: 'openai',
          modelName: config.model,
          createdBy: userId,
        },
      });
      ids.push(row.id);
    }
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        entityId: propertyId,
        action: 'DESIGN_GENERATION_REQUESTED',
        metadata: {
          projectId,
          count: input.variants,
          transmissionConsent: true,
          provider: 'openai',
        },
      },
    });
    return ids;
  });
}
export async function favoriteDesign(
  userId: string,
  sciId: string,
  propertyId: string,
  visualId: string,
) {
  await roomAccess(userId, sciId, propertyId, true);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId} AND "sciId" = ${sciId} FOR UPDATE`;
    const visual = await tx.generatedVisual.findFirst({
      where: { id: visualId, sciId, propertyId, status: 'SUCCEEDED', project: { archived: false } },
    });
    if (!visual) throw new HttpError(404, 'Visualisation introuvable.');
    await tx.generatedVisual.updateMany({
      where: { sciId, propertyId, projectId: visual.projectId, favorite: true },
      data: { favorite: false },
    });
    await tx.generatedVisual.update({ where: { id: visual.id }, data: { favorite: true } });
  });
}
export { projectionPrompt };

export async function archiveDesign(
  userId: string,
  sciId: string,
  propertyId: string,
  projectId: string,
) {
  await roomAccess(userId, sciId, propertyId, true);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SCI" WHERE id = ${sciId} FOR UPDATE`;
    const project = await tx.roomDesignProject.findFirst({
      where: { id: projectId, sciId, propertyId, archived: false },
    });
    if (!project) throw new HttpError(404, 'Projet introuvable.');
    if (
      await tx.generatedVisual.count({
        where: { projectId, status: { in: ['PENDING', 'PROCESSING'] } },
      })
    )
      throw new HttpError(409, 'Attendez la fin des générations avant d’archiver ce projet.');
    await tx.roomDesignProject.update({ where: { id: projectId }, data: { archived: true } });
    await tx.activityLog.create({
      data: {
        sciId,
        actorId: userId,
        entityId: propertyId,
        action: 'DESIGN_PROJECT_ARCHIVED',
        metadata: { projectId },
      },
    });
  });
}
