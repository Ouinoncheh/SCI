import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ membership: vi.fn(), deleteMany: vi.fn() }));
vi.mock('../src/server/db', () => ({ db: { property: { deleteMany: mocks.deleteMany } } }));
vi.mock('../src/server/security', () => ({ membership: mocks.membership, HttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { deleteProperty } from '../src/server/properties';
beforeEach(() => { vi.resetAllMocks(); });
it('scopes deletion to the SCI and expected property version', async () => {
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  await deleteProperty('user', 'sci', 'property', { version: 2 });
  expect(mocks.membership).toHaveBeenCalledWith('user', 'sci', 'write');
  expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: 'property', sciId: 'sci', version: 2 } });
});
it('never deletes for a member without write access', async () => {
  mocks.membership.mockRejectedValue(new Error('Forbidden'));
  await expect(deleteProperty('user', 'sci', 'property', { version: 2 })).rejects.toThrow('Forbidden');
  expect(mocks.deleteMany).not.toHaveBeenCalled();
});
it('rejects stale or missing properties', async () => {
  mocks.deleteMany.mockResolvedValue({ count: 0 });
  await expect(deleteProperty('user', 'sci', 'property', { version: 2 })).rejects.toThrow('modifié');
});
