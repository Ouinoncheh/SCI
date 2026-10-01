import { randomUUID } from 'node:crypto';
import { HttpError } from './security';

function configuration() {
  if (process.env.MEDIA_STORAGE !== 'supabase') return null;
  const base = process.env.SUPABASE_URL ?? '',
    key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'predictsci-private';
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new HttpError(503, 'Stockage des fichiers non configuré.');
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.supabase.co') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !key ||
    !/^[a-z0-9-]+$/.test(bucket)
  )
    throw new HttpError(503, 'Stockage des fichiers non configuré.');
  return { base: url.origin, key, bucket };
}
function pathUrl(path: string) {
  if (!/^[a-zA-Z0-9_/-]+\.[a-z]+$/.test(path) || path.includes('..'))
    throw new HttpError(503, 'Référence de fichier invalide.');
  return path.split('/').map(encodeURIComponent).join('/');
}
export async function storeMedia(parts: Record<string, Uint8Array | undefined>, scope: string) {
  const config = configuration();
  const result: Record<string, { bytes: Uint8Array<ArrayBuffer> | null; path: string | null }> = {};
  const uploaded: string[] = [];
  try {
    if (config) {
      const bucket = await fetch(`${config.base}/storage/v1/bucket/${config.bucket}`, {
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      });
      if (!bucket.ok || (await bucket.json()).public !== false)
        throw new Error('Private bucket required');
    }
    for (const [name, bytes] of Object.entries(parts)) {
      if (!bytes) continue;
      if (bytes.length > 20 * 1024 * 1024) throw new Error('File too large');
      if (!config) {
        result[name] = { bytes: new Uint8Array(bytes), path: null };
        continue;
      }
      const path = `${scope}/${randomUUID()}/${name}.bin`;
      const response = await fetch(
        `${config.base}/storage/v1/object/${config.bucket}/${pathUrl(path)}`,
        {
          method: 'POST',
          headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
            'Content-Type': 'application/octet-stream',
            'x-upsert': 'false',
          },
          body: new Uint8Array(bytes),
          redirect: 'error',
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok) throw new Error('Storage unavailable');
      uploaded.push(path);
      result[name] = { bytes: null, path };
    }
    return result;
  } catch {
    await removeMedia(uploaded);
    throw new HttpError(503, 'Enregistrement du fichier impossible. Réessayez ultérieurement.');
  }
}
export async function removeMedia(paths: string[]) {
  if (!paths.length) return;
  try {
    const config = configuration();
    if (!config) return;
    const response = await fetch(`${config.base}/storage/v1/object/${config.bucket}`, {
      method: 'DELETE',
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: paths }),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) console.error('Nettoyage du stockage indisponible.');
  } catch {
    console.error('Nettoyage du stockage indisponible.');
  }
}
export async function readMedia(
  bytes: Uint8Array | null | undefined,
  path: string | null | undefined,
) {
  if (bytes) return bytes;
  if (!path) throw new HttpError(404, 'Fichier indisponible.');
  const config = configuration();
  if (!config) throw new HttpError(503, 'Stockage des fichiers non configuré.');
  try {
    const response = await fetch(
      `${config.base}/storage/v1/object/authenticated/${config.bucket}/${pathUrl(path)}`,
      {
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
        cache: 'no-store',
      },
    );
    if (!response.ok || !response.body) throw new Error('Unavailable');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 20 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('Too large');
      }
      chunks.push(value);
    }
    return new Uint8Array(Buffer.concat(chunks));
  } catch {
    throw new HttpError(503, 'Lecture du fichier impossible. Réessayez ultérieurement.');
  }
}
