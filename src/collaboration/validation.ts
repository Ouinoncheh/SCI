import { z } from 'zod';
export const commentSchema = z
  .object({
    body: z.string().trim().min(1, 'Écrivez un commentaire.').max(4000),
    mentionedMemberIds: z
      .array(z.string().min(1).max(100))
      .max(20)
      .default([])
      .transform((ids) => [...new Set(ids)]),
  })
  .strict();
export const voteSchema = z
  .object({ choice: z.enum(['FAVORABLE', 'TO_STUDY', 'UNFAVORABLE']).nullable() })
  .strict();
export const cursorSchema = z
  .string()
  .min(1)
  .max(100)
  .nullable()
  .transform((v) => v ?? undefined);
