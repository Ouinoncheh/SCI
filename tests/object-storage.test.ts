import { afterEach, describe, expect, it, vi } from 'vitest';
import { storeMedia, readMedia } from '../src/server/object-storage';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function configure() {
  vi.stubEnv('MEDIA_STORAGE', 'supabase');
  vi.stubEnv('SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fake-private-key');
  vi.stubEnv('SUPABASE_STORAGE_BUCKET', 'predictsci-private');
}
describe('stockage privé des fichiers', () => {
  it('reste compatible avec les fichiers déjà stockés dans PostgreSQL', async () => {
    vi.stubEnv('MEDIA_STORAGE', 'database');
    const bytes = new Uint8Array([1, 2, 3]);
    const result = await storeMedia({ image: bytes }, 'sci/property');
    expect(result.image.path).toBeNull();
    expect(result.image.bytes).toEqual(bytes);
    expect(await readMedia(bytes, null)).toEqual(bytes);
  });
  it('stocke seulement les références en base et lit les objets avec authentification serveur', async () => {
    configure();
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ public: false })))
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2])));
    vi.stubGlobal('fetch', mock);
    const result = await storeMedia({ image: new Uint8Array([1, 2]) }, 'sci/property');
    expect(result.image.bytes).toBeNull();
    expect(result.image.path).toMatch(/^sci\/property\//);
    expect(await readMedia(null, result.image.path)).toEqual(new Uint8Array([1, 2]));
    expect(mock.mock.calls[2][0]).toContain('/object/authenticated/predictsci-private/');
    expect(mock.mock.calls[2][1].headers.Authorization).toBe('Bearer fake-private-key');
  });
  it('nettoie un envoi partiel sans révéler la réponse du fournisseur', async () => {
    configure();
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ public: false })))
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('private detail', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', mock);
    await expect(
      storeMedia({ image: new Uint8Array([1]), thumbnail: new Uint8Array([2]) }, 'sci/property'),
    ).rejects.toThrow('Enregistrement du fichier impossible');
    expect(mock.mock.calls[3][1].method).toBe('DELETE');
  });
  it('refuse les chemins invalides avant de contacter le stockage', async () => {
    configure();
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    await expect(readMedia(null, '../private.bin')).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();
  });
  it('refuse un bucket public avant tout envoi de fichier', async () => {
    configure();
    const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ public: true })));
    vi.stubGlobal('fetch', mock);
    await expect(storeMedia({ image: new Uint8Array([1]) }, 'sci/property')).rejects.toThrow(
      'Enregistrement du fichier impossible',
    );
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
