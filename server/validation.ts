import { z } from 'zod';
import { investmentSchema } from '../financial-engine';
import { propertyDetailsSchema } from '../property-details';
import { listingAttachmentSchema } from '../listing-providers/import-types';
export const sciSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    capital: z.number().finite().min(0).max(1e10),
    taxRegime: z.enum(['SCI_IR', 'SCI_IS']),
    shares: z.number().int().min(1).max(1e9),
  })
  .strict();
export const statusSchema = z.enum([
  'NEW',
  'TO_ANALYZE',
  'INTERESTING',
  'VISIT_PLANNED',
  'OFFER',
  'NEGOTIATION',
  'REJECTED',
  'PURCHASED',
]);
export const propertySchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    city: z.string().trim().min(1).max(100),
    postcode: z.string().regex(/^\d{5}$/),
    rooms: z.number().int().min(0).max(100).default(0),
    dpe: z
      .string()
      .regex(/^[A-G?]$/)
      .default('?'),
    description: z.string().max(20000).default(''),
    investment: investmentSchema,
    address: z.string().trim().max(300).optional(),
    listing: listingAttachmentSchema.optional(),
  })
  .strict();
export const propertyPatchSchema = z
  .object({
    version: z.number().int().positive(),
    status: statusSchema.optional(),
    investment: investmentSchema.optional(),
    details: propertyDetailsSchema.optional(),
  })
  .strict()
  .refine((v) => [v.status, v.investment, v.details].filter((x) => x !== undefined).length === 1);
export const invitationSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
    shares: z.number().int().min(0).max(1e9),
  })
  .strict();
