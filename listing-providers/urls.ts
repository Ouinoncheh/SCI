import { z } from 'zod';
export function publicHttps(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}
export const webUrl = z.string().max(2048).refine(publicHttps, 'URL HTTPS publique requise.');
