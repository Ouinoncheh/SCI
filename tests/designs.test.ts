import { afterEach, describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import {
  DesignProjectionService,
  designSchema,
  projectionPrompt,
  type DesignInput,
} from '../src/visualization/design';
import { runProjectionJob } from '../src/visualization/projection-job';
import { OpenAIImageProvider, designConfiguration } from '../src/server/image-provider';
const project: DesignInput = {
  name: 'Cuisine',
  photoId: 'photo-fixture',
  scenarioId: null,
  style: 'Moderne',
  renovationLevel: 'Rafraîchissement',
  prompt: 'Façades blanches et lumière chaleureuse.',
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('projections IA avec fournisseurs simulés', () => {
  it('conserve les consignes de structure et le prompt original', () => {
    expect(projectionPrompt(project)).toContain('ouvertures visibles');
    expect(projectionPrompt(project)).toContain(project.prompt);
    expect(designSchema.safeParse({ ...project, prompt: '' }).success).toBe(false);
  });
  it('transmet la photo et stocke une image assainie avec miniature', async () => {
    const source = await sharp({
      create: { width: 80, height: 60, channels: 3, background: '#aabbcc' },
    })
      .webp()
      .toBuffer();
    const generated = await sharp({
      create: { width: 100, height: 70, channels: 3, background: '#ccbbaa' },
    })
      .png()
      .toBuffer();
    const generate = vi.fn().mockResolvedValue(generated);
    const store = vi.fn().mockResolvedValue(undefined);
    expect(
      await runProjectionJob(
        source,
        project,
        'fixture-model',
        { id: 'mock', generateRoomProjection: generate },
        store,
      ),
    ).toEqual({ width: 100, height: 70 });
    expect(generate.mock.calls[0][0].image).toEqual(source);
    expect(generate.mock.calls[0][0].prompt).toContain('Style : Moderne');
    const output = store.mock.calls[0][0];
    expect((await sharp(output.image).metadata()).format).toBe('webp');
    expect(output.thumbnail.length).toBeGreaterThan(0);
  });
  it('ne stocke pas un échec et ne relance pas automatiquement', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('fixture failure')),
      store = vi.fn();
    await expect(
      runProjectionJob(
        Buffer.from('source'),
        project,
        'fixture-model',
        { id: 'mock', generateRoomProjection: generate },
        store,
      ),
    ).rejects.toThrow('fixture failure');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(store).not.toHaveBeenCalled();
  });
  it('refuse les résultats qui ne sont pas des images', async () => {
    const store = vi.fn();
    await expect(
      runProjectionJob(
        Buffer.from('source'),
        project,
        'fixture-model',
        { id: 'mock', generateRoomProjection: async () => Buffer.from('<script>bad</script>') },
        store,
      ),
    ).rejects.toThrow();
    expect(store).not.toHaveBeenCalled();
  });
  it('borne les variantes et conserve la mention du comparateur', async () => {
    const generate = vi.fn().mockResolvedValue(Buffer.from('fixture'));
    const service = new DesignProjectionService({ id: 'mock', generateRoomProjection: generate });
    expect(
      await service.generateRoomVariations(Buffer.from('source'), project, 'fixture-model', 3),
    ).toHaveLength(3);
    expect(generate).toHaveBeenCalledTimes(3);
    await expect(
      service.generateRoomVariations(Buffer.from('source'), project, 'fixture-model', 4),
    ).rejects.toThrow();
    expect(service.generateBeforeAfterPreview('/before', '/after').notice).toContain('indicative');
  });
  it('reste désactivé sans activation explicite, clé et modèle supporté', () => {
    vi.stubEnv('DESIGN_GENERATION_ENABLED', 'false');
    vi.stubEnv('OPENAI_API_KEY', 'fixture-key');
    vi.stubEnv('OPENAI_IMAGE_MODEL', 'gpt-image-1.5');
    expect(designConfiguration().ready).toBe(false);
    vi.stubEnv('DESIGN_GENERATION_ENABLED', 'true');
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(designConfiguration().ready).toBe(false);
  });
  it('prépare la requête d’édition sans aucune requête réelle', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: [{ b64_json: Buffer.from('fixture-image').toString('base64') }] }),
      );
    vi.stubGlobal('fetch', request);
    expect(
      await new OpenAIImageProvider('fixture-key').generateRoomProjection({
        image: Buffer.from('fixture-source'),
        prompt: 'fixture prompt',
        model: 'gpt-image-1.5',
      }),
    ).toEqual(Buffer.from('fixture-image'));
    expect(request.mock.calls[0][0]).toBe('https://api.openai.com/v1/images/edits');
    const body = request.mock.calls[0][1].body as FormData;
    expect(body.get('n')).toBe('1');
    expect(body.get('image[]')).toBeInstanceOf(Blob);
  });
});
