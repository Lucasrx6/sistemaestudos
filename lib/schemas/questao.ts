import { z } from 'zod';

export const alternativaSchema = z.object({
  letra: z.string().min(1),
  texto: z.string().min(1)
});

const baseQuestaoSchema = z.object({
  tipo: z.enum(['verdadeiro_falso', 'multipla_escolha', 'redacao']),
  enunciado: z.string().min(1),
  explicacao: z.string().optional().nullable(),
  disciplina: z.string().optional().nullable(),
  assunto: z.string().optional().nullable(),
  nivel: z.enum(['basico', 'intermediario', 'avancado']).optional().nullable(),
  ativo: z.boolean().optional().default(true),
  fonte: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  concursos: z.array(z.string()).optional().nullable()
});

export const questaoBaseInputSchema = baseQuestaoSchema.extend({
  resposta_correta: z.union([z.boolean(), z.string()]).nullable()
});

export const questaoVerdFalsoSchema = baseQuestaoSchema.extend({
  tipo: z.literal('verdadeiro_falso'),
  resposta_correta: z.boolean(),
  alternativas: z.undefined(),
  limite_linhas_min: z.undefined(),
  limite_linhas_max: z.undefined(),
  criterios_avaliacao: z.undefined()
});

export const questaoMultiplaSchema = baseQuestaoSchema.extend({
  tipo: z.literal('multipla_escolha'),
  resposta_correta: z.string().min(1),
  alternativas: z.array(alternativaSchema).min(2),
  limite_linhas_min: z.undefined(),
  limite_linhas_max: z.undefined(),
  criterios_avaliacao: z.undefined()
});

export const questaoRedacaoSchema = baseQuestaoSchema.extend({
  tipo: z.literal('redacao'),
  resposta_correta: z.null().optional(),
  alternativas: z.undefined(),
  limite_linhas_min: z.number().int().positive().optional().nullable(),
  limite_linhas_max: z.number().int().positive().optional().nullable(),
  criterios_avaliacao: z.array(z.string()).min(1)
});

export const questaoInputSchema = z.discriminatedUnion('tipo', [
  questaoVerdFalsoSchema,
  questaoMultiplaSchema,
  questaoRedacaoSchema
]);

export const importPayloadSchema = z.object({
  metadata: z.object({
    fonte: z.string().optional(),
    banca: z.array(z.string()).optional(),
    total_questoes: z.number().optional()
  }).optional(),
  concursos_sugeridos: z.array(z.object({
    slug: z.string(),
    nome: z.string(),
    banca: z.string().optional(),
    ano: z.number().optional()
  })).optional(),
  questoes: z.array(questaoInputSchema)
});
