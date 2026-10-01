import { PropertyNormalizer, type PropertyValues } from './normalized';
/** Conservative labelled extraction: no estimates and no external requests. */
export function extractListingText(raw: string): Partial<PropertyValues> {
  const text = raw.replace(/[\u00a0\u202f]/g, ' ').slice(0, 20000);
  const number = (s: string | undefined) =>
    s ? Number(s.replace(/\s/g, '').replace(',', '.')) : null;
  const amount = (label: string) =>
    number(
      text.match(
        new RegExp(`(?:${label})\\s*[:=]?\\s*([\\d][\\d ]*(?:[.,]\\d+)?)\\s*(?:€|euros?)`, 'i'),
      )?.[1],
    );
  const price =
    amount('prix(?: de vente| du bien| demandé)?') ??
    number(text.match(/(?:^|\n)\s*([\d][\d ]{3,})\s*€/m)?.[1]);
  const surface = number(
    text.match(/(?:surface(?: habitable)?\s*[:=]?\s*|\b)(\d+(?:[.,]\d+)?)\s*m[²2]/i)?.[1],
  );
  const rooms = number(
    text.match(/\b(\d{1,2})\s*pi[eè]ces?\b/i)?.[1] ??
      text.match(/(?:nombre de pi[eè]ces)\s*:\s*(\d+)/i)?.[1],
  );
  const bedrooms = number(text.match(/\b(\d{1,2})\s*chambres?\b/i)?.[1]);
  const getLine = (label: string) =>
    text.match(new RegExp(`(?:^|\\n)\\s*${label}\\s*:\\s*([^\\n]+)`, 'i'))?.[1].trim() ?? null;
  const postalCode =
    getLine('code postal')?.match(/^\d{5}$/)?.[0] ??
    text.match(/(?:^|\n)\s*(\d{5})\s+[A-Za-zÀ-ÿ]/)?.[1] ??
    null;
  // Prefer the location of the property, never an agency/showroom address.
  const locations = [
    ...text.matchAll(
      /(?:[Tt]errain|[Mm]aison|[Aa]ppartement|[Bb]ien)\b[^.!?\n]{0,100}?\s(?:à|sur la commune de|situé à)\s+([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’-]*(?:[ -][A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’-]*)*)/g,
    ),
  ].map((match) => match[1].trim());
  const uniqueLocations = [...new Set(locations)];
  const city =
    getLine('ville|commune') ??
    text.match(/(?:^|\n)\s*\d{5}\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '’-]+)(?:\n|$)/)?.[1].trim() ??
    (uniqueLocations.length === 1 ? uniqueLocations[0] : null);
  const floor = number(
    text
      .match(/(?:[eé]tage\s*:\s*(-?\d+)|\b(\d+)(?:er|e|ème|eme)\s*[eé]tage)/i)
      ?.slice(1)
      .find(Boolean),
  );
  const p: Partial<PropertyValues> = {
    title:
      text
        .split('\n')
        .find((line) => line.trim().length > 3)
        ?.trim()
        .slice(0, 120) ?? null,
    description: text.trim() || null,
    price,
    surface,
    rooms,
    bedrooms,
    postalCode,
    city,
    address: getLine('adresse'),
    floor,
    propertyType:
      /\bterrain\b/i.test(text) &&
      /projet de construction|terrain sélectionné|terrain constructible/i.test(text)
        ? 'LAND'
        : /\bmaison\b/i.test(text)
          ? 'HOUSE'
          : /\bappartement\b/i.test(text)
            ? 'APARTMENT'
            : /\bterrain\b/i.test(text)
              ? 'LAND'
              : null,
    dpe:
      (text.match(/\bDPE\s*[:=-]?\s*([A-G])\b/i)?.[1].toUpperCase() as PropertyValues['dpe']) ??
      null,
    ges:
      (text.match(/\bGES\s*[:=-]?\s*([A-G])\b/i)?.[1].toUpperCase() as PropertyValues['ges']) ??
      null,
    propertyTax: amount('taxe fonci[eè]re(?: annuelle)?'),
    agencyFees: amount('frais d.agence(?: restant [aà] charge)?'),
    condominiumFees: /charges[^\n]*\b(?:annuelles|par an|\/an)\b/i.test(text)
      ? amount('charges(?: de copropri[eé]t[eé])?(?: annuelles)?')
      : null,
  };
  for (const [key, pattern] of Object.entries({
    elevator: 'ascenseur',
    balcony: 'balcon',
    terrace: 'terrasse',
    garden: 'jardin',
    parking: 'parking',
    garage: 'garage',
    cellar: 'cave',
  })) {
    const negative = new RegExp(
      `(?:sans|pas d[e’']?)\\s*${pattern}|${pattern}\\s*:\\s*non`,
      'i',
    ).test(text);
    const positive = new RegExp(
      `(?:avec|présence d[e’']?)\\s*${pattern}|${pattern}\\s*:\\s*oui`,
      'i',
    ).test(text);
    if (negative || positive) (p as Record<string, unknown>)[key] = negative ? false : true;
  }
  return p;
}
export function normalizeListingText(
  raw: string,
  url: string,
  source = 'USER_PROVIDED_LISTING_TEXT',
  confidence = 0.85,
) {
  return new PropertyNormalizer().normalize(url, extractListingText(raw), source, confidence);
}
