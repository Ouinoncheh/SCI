import { describe, expect, it } from 'vitest';
import { extractBinaryWebarchive } from '../src/listing-providers/webarchive';

describe('Safari binary webarchive', () => {
  const fixture = Buffer.from('YnBsaXN0MDDRAQJfEA9XZWJNYWluUmVzb3VyY2XTAwQFBgcIXxAPV2ViUmVzb3VyY2VEYXRhXxATV2ViUmVzb3VyY2VNSU1FVHlwZV8QG1dlYlJlc291cmNlVGV4dEVuY29kaW5nTmFtZU8QHTxodG1sPk1haXNvbiDDoCBJc3RyZXM8L2h0bWw+WXRleHQvaHRtbFVVVEYtOAgLHSQ2TGqKlAAAAAAAAAEBAAAAAAAAAAkAAAAAAAAAAAAAAAAAAACa', 'base64');
  it('extracts UTF-8 main HTML from a Safari binary property list', () => {
    expect(extractBinaryWebarchive(fixture)).toBe('<html>Maison à Istres</html>');
  });
  it('rejects truncated archives and corrupt offset tables', () => {
    const file = fixture;
    expect(() => extractBinaryWebarchive(file.subarray(0, 100))).toThrow();
    const corrupt = Buffer.from(file);
    corrupt.fill(255, corrupt.length - 8);
    expect(() => extractBinaryWebarchive(corrupt)).toThrow();
  });
});
