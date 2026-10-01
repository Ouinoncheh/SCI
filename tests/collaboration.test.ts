import { describe, it, expect } from 'vitest';
import { commentSchema, voteSchema, cursorSchema } from '../src/collaboration/validation';
describe('Validation des échanges familiaux', () => {
  it('rejette le texte vide et limite la taille des commentaires', () => {
    expect(commentSchema.safeParse({ body: ' \n ' }).success).toBe(false);
    expect(commentSchema.safeParse({ body: 'a'.repeat(4001) }).success).toBe(false);
    expect(commentSchema.parse({ body: '  Visite à prévoir.  ' })).toEqual({
      body: 'Visite à prévoir.',
      mentionedMemberIds: [],
    });
  });
  it('rejette les identités et rôles fournis par le client', () => {
    expect(commentSchema.safeParse({ body: 'Avis', memberId: 'autre' }).success).toBe(false);
    expect(voteSchema.safeParse({ choice: 'FAVORABLE', memberId: 'autre' }).success).toBe(false);
  });
  it('déduplique les destinataires et limite les mentions', () => {
    expect(
      commentSchema.parse({ body: 'Avis', mentionedMemberIds: ['m1', 'm1', 'm2'] })
        .mentionedMemberIds,
    ).toEqual(['m1', 'm2']);
    expect(
      commentSchema.safeParse({
        body: 'Avis',
        mentionedMemberIds: Array.from({ length: 21 }, (_, i) => `m${i}`),
      }).success,
    ).toBe(false);
  });
  it('autorise les trois avis et le retrait, jamais une note financière', () => {
    for (const choice of ['FAVORABLE', 'TO_STUDY', 'UNFAVORABLE', null])
      expect(voteSchema.safeParse({ choice }).success).toBe(true);
    expect(voteSchema.safeParse({ choice: 100 }).success).toBe(false);
    expect(voteSchema.safeParse({ choice: 'ADMIN' }).success).toBe(false);
  });
  it('borne les curseurs', () => {
    expect(cursorSchema.parse(null)).toBeUndefined();
    expect(cursorSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });
});
