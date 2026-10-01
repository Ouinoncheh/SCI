import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import ipaddr from 'ipaddr.js';
import { publicHttps } from '../listing-providers/import-types';
import { ListingFetchError, logImport, type ImportDiagnostic } from './import-log';

export function allowedListingUrl(raw: string, domains: string[]) {
  if (!publicHttps(raw)) throw new Error('URL HTTPS publique invalide.');
  const url = new URL(raw);
  if (!domains.includes(url.hostname))
    throw new Error(
      'Cette source n’est pas connectée. Utilisez le texte ou le fichier HTML autorisé de l’annonce.',
    );
  return url;
}
export function isPublicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}
export async function fetchListingHtml(raw: string) {
  const domains = (process.env.LISTING_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const diagnostic: ImportDiagnostic = {
    url: raw,
    provider: new URL(raw).hostname,
    method: 'GET',
    status: null,
    allow: null,
    contentType: null,
    stage: 'policy',
  };
  let url: URL;
  try {
    url = allowedListingUrl(raw, domains);
  } catch {
    logImport(diagnostic);
    throw new ListingFetchError(diagnostic);
  }
  diagnostic.stage = 'dns';
  const addresses = await lookup(url.hostname, { all: true }).catch(() => {
    logImport(diagnostic);
    throw new ListingFetchError({ ...diagnostic });
  });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address))) {
    logImport(diagnostic);
    throw new ListingFetchError({ ...diagnostic });
  }
  const pinned = addresses[0];
  return new Promise<string>((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        agent: false,
        family: pinned.family,
        lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
        headers: {
          'User-Agent': 'PredictSCI/0.4 (authorized listing import)',
          Accept: 'text/html',
          'Accept-Encoding': 'identity',
        },
      },
      (res) => {
        Object.assign(diagnostic, {
          status: res.statusCode ?? null,
          allow: res.headers.allow ?? null,
          contentType: res.headers['content-type'] ?? null,
          stage: 'remote_response',
        });
        logImport(diagnostic);
        if (
          res.statusCode !== 200 ||
          !res.headers['content-type']?.includes('text/html') ||
          (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')
        ) {
          res.destroy();
          reject(new ListingFetchError({ ...diagnostic }));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2_000_000) req.destroy(new Error('Page trop volumineuse (2 Mo maximum).'));
          else chunks.push(chunk);
        });
        res.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf8');
          if (
            /captcha-delivery\.com|DataDome Device Check|cf-chl-|id=["']challenge-form/i.test(html)
          ) {
            const failed = { ...diagnostic, stage: 'remote_challenge' };
            logImport(failed);
            reject(new ListingFetchError(failed));
          } else resolve(html);
        });
        res.on('error', reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error('Le site n’a pas répondu dans les 10 secondes.')),
      10000,
    );
    req.on('close', () => clearTimeout(timer));
    req.on('error', () => {
      const failed = { ...diagnostic, stage: 'network_or_timeout' };
      logImport(failed);
      reject(new ListingFetchError(failed));
    });
    req.end();
  });
}
