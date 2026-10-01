import { randomUUID } from 'node:crypto';
import { db } from './db';
import { readMedia, storeMedia, removeMedia } from './object-storage';
import { designSchema } from '../visualization/design';
import { runProjectionJob } from '../visualization/projection-job';
import { designConfiguration, OpenAIImageProvider } from './image-provider';
const staleMessage =
  'Génération interrompue. Aucun nouvel appel automatique : vérifiez votre consommation avant de relancer.';
export async function processDesignQueue() {
  if (!designConfiguration().ready) return;
  const stale = new Date(Date.now() - 5 * 60 * 1000);
  await db.generatedVisual.updateMany({
    where: { status: 'PROCESSING', startedAt: { lt: stale } },
    data: { status: 'FAILED', errorMessage: staleMessage, completedAt: new Date(), leaseId: null },
  });
  const leaseId = randomUUID();
  const job = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "GeneratedVisual" WHERE status = 'PENDING' ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!rows.length) return null;
    return tx.generatedVisual.update({
      where: { id: rows[0].id },
      data: { status: 'PROCESSING', startedAt: new Date(), leaseId },
      include: { project: true },
    });
  });
  if (!job) return;
  try {
    const photo = await db.roomPhoto.findFirst({
      where: {
        id: job.project.photoId,
        sciId: job.sciId,
        propertyId: job.propertyId,
        roomId: job.project.roomId,
      },
      select: { image: true, imagePath: true },
    });
    if (!photo) throw new Error('Source indisponible');
    const input = designSchema.parse({
      name: job.project.name,
      photoId: job.project.photoId,
      scenarioId: job.project.scenarioId,
      style: job.project.style,
      renovationLevel: job.project.renovationLevel,
      prompt: job.project.prompt,
    });
    await runProjectionJob(
      Buffer.from(await readMedia(photo.image, photo.imagePath)),
      input,
      job.modelName,
      new OpenAIImageProvider(process.env.OPENAI_API_KEY!),
      async (output) => {
        const media = await storeMedia(
          { image: output.image, thumbnail: output.thumbnail },
          `${job.sciId}/${job.propertyId}`,
        );
        try {
          const updated = await db.generatedVisual.updateMany({
            where: { id: job.id, status: 'PROCESSING', leaseId },
            data: {
              status: 'SUCCEEDED',
              image: media.image.bytes,
              thumbnail: media.thumbnail.bytes,
              imagePath: media.image.path,
              thumbnailPath: media.thumbnail.path,
              width: output.width,
              height: output.height,
              completedAt: new Date(),
              leaseId: null,
            },
          });
          if (!updated.count)
            await removeMedia(
              Object.values(media).flatMap((part) => (part.path ? [part.path] : [])),
            );
        } catch (error) {
          await removeMedia(Object.values(media).flatMap((part) => (part.path ? [part.path] : [])));
          throw error;
        }
      },
    );
  } catch {
    await db.generatedVisual.updateMany({
      where: { id: job.id, status: 'PROCESSING', leaseId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        leaseId: null,
        errorMessage:
          'La génération n’a pas abouti. Aucune relance automatique ; vérifiez le fournisseur avant une nouvelle demande.',
      },
    });
  }
}
const globals = globalThis as unknown as { designWorkerStarted?: boolean };
export function startDesignWorker() {
  if (globals.designWorkerStarted || !designConfiguration().ready) return;
  globals.designWorkerStarted = true;
  const tick = async () => {
    try {
      await processDesignQueue();
    } catch {
      console.error('Design worker unavailable');
    } finally {
      setTimeout(() => void tick(), 2500).unref();
    }
  };
  setTimeout(() => void tick(), 2500).unref();
}
