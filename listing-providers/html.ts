import { load } from 'cheerio';
import { publicHttps, type ImportedListing } from './import-types';
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {};
const str = (v: unknown, max = 20000) =>
  typeof v === 'string' ? load(v).text().trim().slice(0, max) || null : null;
function num(v: unknown) {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
        ? Number(v.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'))
        : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
/** Read inert markup only. Never executes scripts or loads images/subresources. */
export function parseListingHtml(html: string, sourceUrl: string): ImportedListing {
  if (Buffer.byteLength(html) > 2_000_000) throw new Error('Page trop volumineuse (2 Mo maximum).');
  const $ = load(html);
  const nodes: Obj[] = [];
  function walk(v: unknown, depth = 0) {
    if (depth > 12 || nodes.length > 2000) return;
    if (Array.isArray(v)) {
      v.forEach((x) => walk(x, depth + 1));
      return;
    }
    const o = obj(v);
    if (!Object.keys(o).length) return;
    nodes.push(o);
    Object.values(o).forEach((x) => {
      if (typeof x === 'object') walk(x, depth + 1);
    });
  }
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      walk(JSON.parse($(el).text()));
    } catch {
      /* Invalid block is not executable code. */
    }
  });
  const types = (o: Obj) => [o['@type']].flat().join(' ');
  const homes = nodes.filter((o) =>
    /^(Apartment|House|SingleFamilyResidence|Residence|Accommodation)$/.test(types(o)),
  );
  const listings = nodes.filter((o) => /^(RealEstateListing|Product)$/.test(types(o)));
  const ambiguous = homes.length > 1 || listings.length > 1;
  const home = ambiguous ? {} : (homes[0] ?? {});
  const listing = ambiguous ? {} : (listings[0] ?? home);
  const offer = obj(
    Array.isArray(listing.offers) ? listing.offers[0] : (listing.offers ?? home.offers),
  );
  const address = obj(home.address ?? listing.address);
  const meta = (key: string) =>
    str($(`meta[property="${key}"], meta[name="${key}"]`).first().attr('content'));
  const description =
    str(listing.description ?? home.description) ??
    meta('og:description') ??
    meta('description') ??
    '';
  const images: unknown[] = [home.image, listing.image, meta('og:image')].flat(2);
  const photos = [
    ...new Set(
      images
        .map((v) => (typeof v === 'string' ? v : (obj(v).contentUrl ?? obj(v).url)))
        .filter((v): v is string => typeof v === 'string')
        .flatMap((v) => {
          try {
            const url = new URL(v, sourceUrl).href;
            return publicHttps(url) ? [url] : [];
          } catch {
            return [];
          }
        }),
    ),
  ].slice(0, 20);
  const area = obj(home.floorSize ?? listing.floorSize);
  const currency = offer.priceCurrency;
  const price = currency === 'EUR' ? num(offer.price) : null;
  const rooms = num(home.numberOfRooms ?? listing.numberOfRooms);
  const dpe = description.match(/\bDPE\s*[:\-]?\s*([A-G])\b/i)?.[1].toUpperCase() ?? null;
  return {
    sourceUrl,
    title:
      str(listing.name ?? home.name, 120) ??
      meta('og:title')?.slice(0, 120) ??
      str($('h1').first().text(), 120),
    description,
    price,
    area: ['MTK', 'm²', 'm2'].includes(String(area.unitCode ?? area.unitText))
      ? num(area.value)
      : null,
    city: str(address.addressLocality, 100),
    postcode: /^\d{5}$/.test(String(address.postalCode)) ? String(address.postalCode) : null,
    address: str(address.streetAddress, 300),
    rooms: rooms && Number.isInteger(rooms) && rooms <= 100 ? rooms : null,
    dpe,
    photos,
    warnings: [
      'Extraction automatique à vérifier : les champs absents restent à renseigner.',
      ...(ambiguous
        ? ['Plusieurs biens détectés : les caractéristiques ambiguës ne sont pas importées.']
        : []),
      ...(price === null ? ['Prix EUR structuré indisponible.'] : []),
      'Seules les photos déclarées dans les métadonnées sont proposées ; leur chargement dépend du site source.',
    ],
  };
}
