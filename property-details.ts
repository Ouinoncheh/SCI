import { z } from 'zod';

export const propertyDetailsSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    city: z.string().trim().min(1).max(100),
    postcode: z.string().regex(/^\d{5}$/),
    address: z.string().trim().max(300),
    rooms: z.number().int().min(0).max(100),
    dpe: z.enum(['?', 'A', 'B', 'C', 'D', 'E', 'F', 'G']),
    description: z.string().max(20000),
  })
  .strict();
export type PropertyDetails = z.infer<typeof propertyDetailsSchema>;
