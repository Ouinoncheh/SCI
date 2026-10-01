import sharp from 'sharp';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { db } from './db';
import { storeMedia, removeMedia } from './object-storage';
import { HttpError } from './security';
import { draftAccess, importDraft } from './import-drafts';
import { normalizePhoto } from '../visualization/images';
const limit = 8 * 1024 * 1024;
export async function readImportMultipart(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
    throw new HttpError(415, 'Formulaire fichier requis.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Fichier manquant.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit + 16384) {
      await reader.cancel();
      throw new HttpError(413, 'Fichier limité à 8 Mo.');
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), {
    headers: { 'Content-Type': request.headers.get('content-type')! },
  }).formData();
}
export async function extractDocumentText(data: Buffer, filename: string) {
  if (data.length > limit) throw new HttpError(413, 'Document limité à 8 Mo.');
  if (data.subarray(0, 5).toString() === '%PDF-') {
    const parser = new PDFParse({ data, isEvalSupported: false });
    try {
      const info = await parser.getInfo();
      if (info.total > 20) throw new HttpError(400, 'Document limité à 20 pages.');
      const result = await parser.getText();
      return result.text.slice(0, 20000);
    } finally {
      await parser.destroy();
    }
  }
  if (filename.toLowerCase().endsWith('.docx') && data.subarray(0, 2).toString() === 'PK')
    return (await mammoth.extractRawText({ buffer: data })).value.slice(0, 20000);
  if (filename.toLowerCase().endsWith('.txt') && !data.includes(0))
    return data.toString('utf8').slice(0, 20000);
  throw new HttpError(400, 'Document PDF, DOCX ou TXT requis.');
}
export async function screenshotText(data: Buffer) {
  const cache = path.join(process.cwd(), '.local', 'ocr');
  await mkdir(cache, { recursive: true });
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      createWorker('fra', 1, { cachePath: cache, logger: () => {} })
        .then(async (created) => {
          if (expired) {
            await created.terminate();
            throw new Error('OCR expiré');
          }
          worker = created;
          return created.recognize(data);
        })
        .then((result) => ({
          text: result.data.text.slice(0, 20000),
          confidence: result.data.confidence / 100,
        })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error('Lecture de capture trop longue.'));
        }, 30000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await worker?.terminate();
  }
}
export async function addImportFile(userId: string, sciId: string, id: string, request: Request) {
  const draft = await draftAccess(userId, sciId, id, true);
  if (draft.status === 'CONVERTED') throw new HttpError(409, 'Brouillon déjà enregistré.');
  const form = await readImportMultipart(request);
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Fichier manquant.');
  const kind = String(form.get('kind'));
  if (!['document', 'screenshot', 'photo'].includes(kind))
    throw new HttpError(400, 'Type de fichier invalide.');
  const data = Buffer.from(await file.arrayBuffer());
  if (data.length > limit) throw new HttpError(413, 'Fichier limité à 8 Mo.');
  let original = data,
    medium: Buffer | undefined,
    thumbnail: Buffer | undefined,
    width: number | undefined,
    height: number | undefined,
    mimeType = file.type;
  let text = '',
    warning: string | null = null;
  if (kind === 'document') {
    try {
      text = await extractDocumentText(data, file.name);
    } catch (e) {
      throw e instanceof HttpError ? e : new HttpError(400, 'Document illisible ou protégé.');
    }
  } else {
    try {
      const converted = await normalizePhoto(data);
      medium = converted.image;
      thumbnail = converted.thumbnail;
      width = converted.width;
      height = converted.height;
      // Full resolution sanitized original; remove GPS/EXIF, do not retain potentially active uploads.
      original = await sharp(data, { limitInputPixels: 40_000_000 })
        .rotate()
        .webp({ quality: 90 })
        .toBuffer();
      mimeType = 'image/webp';
      if (kind === 'screenshot')
        try {
          text = (await screenshotText(medium)).text;
        } catch {
          warning =
            'Capture conservée. Lecture automatique indisponible ; collez son texte pour continuer.';
        }
    } catch {
      throw new HttpError(400, 'Image JPEG, PNG ou WebP invalide.');
    }
  }
  const media = await storeMedia({ original, medium, thumbnail }, `${sciId}/${id}`);
  const asset = await db
    .$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PropertyImportDraft" WHERE id = ${id} AND "sciId" = ${sciId} FOR UPDATE`;
      const current = await tx.propertyImportDraft.findFirst({
        where: { id, sciId, status: { not: 'CONVERTED' } },
      });
      if (!current) throw new HttpError(409, 'Brouillon déjà enregistré.');
      if ((await tx.importAsset.count({ where: { draftId: id, sciId } })) >= 20)
        throw new HttpError(409, 'Limite de 20 fichiers par brouillon.');
      return tx.importAsset.create({
        data: {
          sciId,
          draftId: id,
          kind,
          originalFilename: file.name.replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(0, 180),
          mimeType,
          original: media.original.bytes,
          originalPath: media.original.path,
          medium: media.medium?.bytes,
          mediumPath: media.medium?.path,
          thumbnail: media.thumbnail?.bytes,
          thumbnailPath: media.thumbnail?.path,
          width,
          height,
        },
        select: { id: true },
      });
    })
    .catch(async (error) => {
      await removeMedia(Object.values(media).flatMap((part) => (part.path ? [part.path] : [])));
      throw error;
    });
  let updated = await draftAccess(userId, sciId, id);
  if (text.trim()) {
    try {
      updated = {
        ...updated,
        ...(await importDraft(
          userId,
          sciId,
          { url: draft.sourceUrl, text, draftId: id, version: draft.version },
          kind === 'document' ? 'USER_PROVIDED_DOCUMENT' : 'USER_PROVIDED_SCREENSHOT_OCR',
        )),
      };
    } catch (e) {
      if (e instanceof HttpError && e.status === 409)
        warning = 'Fichier conservé ; le brouillon a changé pendant sa lecture. Rechargez-le.';
      else throw e;
    }
  } else if (kind === 'document')
    warning = 'Aucun texte détecté : ajoutez une capture lisible ou collez le texte.';
  return { draft: updated, assetId: asset.id, text, warning };
}
