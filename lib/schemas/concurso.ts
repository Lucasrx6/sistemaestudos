import { z } from 'zod';

export const concursoCreateSchema = z.object({
  slug: z.string().min(1),
  nome: z.string().min(1),
  banca: z.string().optional().nullable(),
  ano: z.number().int().positive().optional().nullable()
});

export const concursoUpdateSchema = concursoCreateSchema.extend({
  id: z.string().uuid()
});
