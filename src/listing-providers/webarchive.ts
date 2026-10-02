/** Reads only WebMainResource from Safari binary plists; embedded resources stay local. */
export function extractBinaryWebarchive(input: Uint8Array): string {
  return readBinaryWebarchive(input).html;
}
export function readBinaryWebarchive(input: Uint8Array): { html: string; url?: string } {
  const fail = () => new Error('Webarchive Safari invalide ou page principale indisponible.');
  if (input.length < 40 || new TextDecoder().decode(input.subarray(0, 8)) !== 'bplist00') throw fail();
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  function integer(offset: number, size: number): number {
    if (![1, 2, 4, 8].includes(size) || offset < 0 || offset + size > input.length) throw fail();
    let value = 0;
    for (let i = 0; i < size; i++) value = value * 256 + view.getUint8(offset + i);
    if (!Number.isSafeInteger(value)) throw fail();
    return value;
  }
  const trailer = input.length - 32;
  const offsetSize = input[trailer + 6], refSize = input[trailer + 7];
  const count = integer(trailer + 8, 8), root = integer(trailer + 16, 8);
  const table = integer(trailer + 24, 8);
  if (!count || count > 1000000 || root >= count || table < 8 || table + count * offsetSize > trailer) throw fail();
  function object(ref: number) {
    if (ref < 0 || ref >= count) throw fail();
    const offset = integer(table + ref * offsetSize, offsetSize);
    if (offset < 8 || offset >= table) throw fail();
    const type = input[offset] >> 4;
    let length = input[offset] & 15, start = offset + 1;
    if (length === 15) {
      if ((input[start] >> 4) !== 1) throw fail();
      const size = 2 ** (input[start] & 15);
      length = integer(start + 1, size);
      start += size + 1;
    }
    const bytes = type === 6 ? length * 2 : type === 13 ? length * refSize * 2 : length;
    if (start + bytes > table) throw fail();
    return { type, length, start };
  }
  function string(ref: number): string {
    const { type, length, start } = object(ref);
    if (type !== 5 && type !== 6) throw fail();
    return new TextDecoder(type === 6 ? 'utf-16be' : 'utf-8').decode(input.subarray(start, start + length * (type === 6 ? 2 : 1)));
  }
  function field(ref: number, name: string): number | undefined {
    const { type, length, start } = object(ref);
    if (type !== 13 || length > 10000) throw fail();
    for (let i = 0; i < length; i++) {
      if (string(integer(start + i * refSize, refSize)) === name)
        return integer(start + (length + i) * refSize, refSize);
    }
  }
  const main = field(root, 'WebMainResource');
  if (main === undefined) throw fail();
  const mime = field(main, 'WebResourceMIMEType');
  if (mime !== undefined && !['text/html', 'application/xhtml+xml'].includes(string(mime).toLowerCase())) throw fail();
  const data = field(main, 'WebResourceData');
  if (data === undefined) throw fail();
  const resource = object(data);
  if (resource.type !== 4 || !resource.length) throw fail();
  const encoding = field(main, 'WebResourceTextEncodingName');
  let decoder: TextDecoder;
  try { decoder = new TextDecoder(encoding === undefined ? 'utf-8' : string(encoding)); }
  catch { throw new Error('Encodage de la page Safari non pris en charge.'); }
  const source = field(main, 'WebResourceURL');
  return { html: decoder.decode(input.subarray(resource.start, resource.start + resource.length)),
    url: source === undefined ? undefined : string(source) };
}
