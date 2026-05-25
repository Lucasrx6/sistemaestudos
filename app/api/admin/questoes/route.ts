import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

const questaoCreateSchema = z.object({
  tipo: z.enum(['verdadeiro_falso', 'multipla_escolha', 'redacao']),
  enunciado: z.string().min(1),
  explicacao: z.string().optional().nullable(),
  disciplina: z.string().optional().nullable(),
  assunto: z.string().optional().nullable(),
  nivel: z.enum(['basico', 'intermediario', 'avancado']).optional().nullable(),
  ativo: z.boolean().optional().default(true),
  fonte: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  concursos: z.array(z.string()).optional().nullable(),
  resposta_correta: z.union([z.boolean(), z.string()]).nullable(),
  alternativas: z.array(z.object({ letra: z.string(), texto: z.string() })).optional().nullable(),
  limite_linhas_min: z.number().int().positive().optional().nullable(),
  limite_linhas_max: z.number().int().positive().optional().nullable(),
  criterios_avaliacao: z.array(z.string()).optional().nullable()
});

const questaoUpdateSchema = questaoCreateSchema.extend({ id: z.string().uuid() });

function normalizeQuestionPayload(data: z.infer<typeof questaoCreateSchema>) {
  const isVF = data.tipo === 'verdadeiro_falso';
  const isMultiple = data.tipo === 'multipla_escolha';
  const isRedacao = data.tipo === 'redacao';

  return {
    tipo: data.tipo,
    enunciado: data.enunciado,
    explicacao: data.explicacao ?? null,
    disciplina: data.disciplina ?? null,
    assunto: data.assunto ?? null,
    nivel: data.nivel ?? null,
    ativo: data.ativo ?? true,
    fonte: data.fonte ?? null,
    tags: data.tags ?? null,
    resposta_correta: isMultiple ? (data.resposta_correta as string) : null,
    resposta_correta_boolean: isVF ? (data.resposta_correta as boolean) : null,
    alternativas: isMultiple ? data.alternativas ?? null : null,
    limite_linhas_min: isRedacao ? data.limite_linhas_min ?? null : null,
    limite_linhas_max: isRedacao ? data.limite_linhas_max ?? null : null,
    criterios_avaliacao: isRedacao ? data.criterios_avaliacao ?? null : null
  };
}

async function getConcursoMap(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, slugs: string[]) {
  const { data, error } = await supabaseAdmin.from('concursos').select('id,slug').in('slug', slugs);
  if (error) {
    throw error;
  }
  return new Map(data.map((item: any) => [item.slug, item.id]));
}

export async function GET(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const tipo = searchParams.get('tipo');
  const ativo = searchParams.get('ativo');

  let query: any = supabaseAdmin.from('questoes').select('*, questao_concurso(concurso_id)');
  if (id) {
    query = query.eq('id', id).maybeSingle();
  } else {
    query = query.order('created_at', { ascending: false });
    if (tipo) query = query.eq('tipo', tipo);
    if (ativo === 'true' || ativo === 'false') query = query.eq('ativo', ativo === 'true');
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: concursos, error: concursosError } = await supabaseAdmin.from('concursos').select('id,slug,nome');
  if (concursosError) {
    return NextResponse.json({ error: concursosError.message }, { status: 500 });
  }

  const concursoMap = new Map((concursos ?? []).map((item: any) => [item.id, item.slug]));

  const formatQuestao = (item: any) => ({
    ...item,
    concursos: (item.questao_concurso ?? []).map((relation: any) => concursoMap.get(relation.concurso_id)).filter(Boolean)
  });

  if (!id) {
    const result = (data ?? []).map(formatQuestao);
    return NextResponse.json(result);
  }

  if (!data) {
    return NextResponse.json({ error: 'Questão não encontrada.' }, { status: 404 });
  }

  return NextResponse.json(formatQuestao(data));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = questaoCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const payload = normalizeQuestionPayload(parsed.data);

  const { data: created, error: createError } = await supabaseAdmin.from('questoes').insert(payload).select('id').single();
  if (createError || !created) {
    return NextResponse.json({ error: createError?.message || 'Erro ao criar questão.' }, { status: 500 });
  }

  const relations: any[] = [];
  if (parsed.data.concursos?.length) {
    const concursoMap = await getConcursoMap(supabaseAdmin, parsed.data.concursos);
    const missing = parsed.data.concursos.filter((slug) => !concursoMap.has(slug));
    if (missing.length) {
      await supabaseAdmin.from('questoes').delete().eq('id', created.id);
      return NextResponse.json({ error: `Concursos não encontrados: ${missing.join(', ')}` }, { status: 400 });
    }

    relations.push(...parsed.data.concursos.map((slug) => ({
      questao_id: created.id,
      concurso_id: concursoMap.get(slug)
    })));
  }

  if (relations.length) {
    const { error: relationError } = await supabaseAdmin.from('questao_concurso').insert(relations);
    if (relationError) {
      await supabaseAdmin.from('questoes').delete().eq('id', created.id);
      return NextResponse.json({ error: relationError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, id: created.id });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = questaoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const payload = normalizeQuestionPayload(parsed.data);

  const { error: updateError } = await supabaseAdmin.from('questoes').update(payload).eq('id', parsed.data.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (parsed.data.concursos) {
    await supabaseAdmin.from('questao_concurso').delete().eq('questao_id', parsed.data.id);
    const concursoMap = await getConcursoMap(supabaseAdmin, parsed.data.concursos);
    const missing = parsed.data.concursos.filter((slug) => !concursoMap.has(slug));
    if (missing.length) {
      return NextResponse.json({ error: `Concursos não encontrados: ${missing.join(', ')}` }, { status: 400 });
    }

    const relations = parsed.data.concursos.map((slug) => ({
      questao_id: parsed.data.id,
      concurso_id: concursoMap.get(slug)
    }));

    const { error: relationError } = await supabaseAdmin.from('questao_concurso').insert(relations);
    if (relationError) {
      return NextResponse.json({ error: relationError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID da questão é obrigatório.' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from('questoes').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
