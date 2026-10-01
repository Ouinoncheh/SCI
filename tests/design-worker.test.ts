import { beforeEach, describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({
  ready: true,
  updateMany: vi.fn(),
  claim: vi.fn(),
  raw: vi.fn(),
  photo: vi.fn(),
  generate: vi.fn(),
}));
vi.mock('../src/server/db', () => ({
  db: {
    generatedVisual: { updateMany: mocks.updateMany },
    roomPhoto: { findFirst: mocks.photo },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({ $queryRaw: mocks.raw, generatedVisual: { update: mocks.claim } }),
  },
}));
vi.mock('../src/server/image-provider', () => ({
  designConfiguration: () => ({ ready: mocks.ready }),
  OpenAIImageProvider: class {
    readonly id = 'mock';
    generateRoomProjection = mocks.generate;
  },
}));
import { processDesignQueue } from '../src/server/design-worker';
const job = {
  id: 'job-1',
  sciId: 'sci-fixture',
  propertyId: 'property-fixture',
  modelName: 'mock-model',
  project: {
    name: 'Salon',
    photoId: 'photo-fixture',
    roomId: 'room-fixture',
    scenarioId: null,
    style: 'Moderne',
    renovationLevel: 'Rafraîchissement',
    prompt: 'Peindre les murs dans une teinte chaude.',
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.ready = true;
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.raw.mockResolvedValue([{ id: job.id }]);
  mocks.claim.mockResolvedValue(job);
});
describe('jobs persistants de projection avec stockage simulé', () => {
  it('ne traite rien lorsque la génération est désactivée', async () => {
    mocks.ready = false;
    await processDesignQueue();
    expect(mocks.raw).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('prend un job en traitement puis conserve son résultat comme réussi', async () => {
    const image = await sharp({
      create: { width: 70, height: 50, channels: 3, background: '#c8b8a8' },
    })
      .webp()
      .toBuffer();
    mocks.photo.mockResolvedValue({ image });
    mocks.generate.mockResolvedValue(image);
    await processDesignQueue();
    expect(mocks.claim.mock.calls[0][0].data.status).toBe('PROCESSING');
    const written = mocks.updateMany.mock.calls.find(([v]) => v.data.status === 'SUCCEEDED')?.[0];
    expect(written).toBeDefined();
    expect(written.data.image).toBeInstanceOf(Uint8Array);
    expect(written.data.thumbnail.length).toBeGreaterThan(0);
    expect(written.where.leaseId).toBeTruthy();
  });
  it('marque un refus comme échec et ne renvoie pas le détail fournisseur', async () => {
    mocks.photo.mockResolvedValue({ image: Buffer.from('source') });
    mocks.generate.mockRejectedValue(new Error('secret-provider-details'));
    await processDesignQueue();
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    const written = mocks.updateMany.mock.calls.find(
      ([v]) => v.where.id === job.id && v.data.status === 'FAILED',
    )?.[0];
    expect(written.data.errorMessage).not.toContain('secret-provider-details');
    expect(written.data.errorMessage).toContain('Aucune relance automatique');
  });
});
