import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { importPayloadSchema, questaoInputSchema } from '@/lib/schemas/questao';

export async function POST(request: NextRequest) {
  const rawPayload = await request.json();
  const parsedPayload = importPayloadSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    return NextResponse.json({ error: parsedPayload.error.flatten() }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const payload = parsedPayload.data;
  const questoes = payload.questoes;
  const allSlugs = Array.from(new Set(questoes.flatMap((question) => question.concursos ?? [])));

  const { data: concursosData, error: concursosError } = await supabaseAdmin.from('concursos').select('id,slug').in('slug', allSlugs);
  if (concursosError) {
    return NextResponse.json({ error: concursosError.message }, { status: 500 });
  }

  const concursoMap = new Map((concursosData ?? []).map((item: any) => [item.slug, item.id]));
  const suggestedMap = new Map((payload.concursos_sugeridos ?? []).map((item: any) => [item.slug, item]));
  const response = {
    inseridas: 0,
    erros: [] as Array<{ indice: number; motivo: string; questao: unknown }>,
    concursosCriados: [] as string[]
  };

  const missingSlugs = allSlugs.filter((slug) => !concursoMap.has(slug));
  if (missingSlugs.length > 0) {
    const toCreate = missingSlugs.map((slug) => {
      const suggested = suggestedMap.get(slug);
      return {
        slug,
        nome: suggested?.nome ?? slug,
        banca: suggested?.banca ?? null,
        ano: suggested?.ano ?? null
      };
    });

    const { data: createdConcursos, error: createError } = await supabaseAdmin.from('concursos').insert(toCreate).select('id,slug');
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    for (const item of createdConcursos ?? []) {
      concursoMap.set(item.slug, item.id);
      response.concursosCriados.push(item.slug);
    }
  }

  const stillMissing = allSlugs.filter((slug) => !concursoMap.has(slug));
  if (stillMissing.length) {
    return NextResponse.json({ error: `Concursos não encontrados e não sugeridos: ${stillMissing.join(', ')}` }, { status: 400 });
  }

  for (let index = 0; index < questoes.length; index += 1) {
    const questao = questoes[index];
    const parsedQuestao = questaoInputSchema.safeParse(questao);
    if (!parsedQuestao.success) {
      response.erros.push({ indice: index, motivo: 'Questão inválida', questao });
      continue;
    }

    const missingConcursos = (parsedQuestao.data.concursos ?? []).filter((slug) => !concursoMap.has(slug));
    if (missingConcursos.length) {
      response.erros.push({ indice: index, motivo: `Concursos não encontrados: ${missingConcursos.join(', ')}`, questao });
      continue;
    }

    const isVF = parsedQuestao.data.tipo === 'verdadeiro_falso';
    const isMultiple = parsedQuestao.data.tipo === 'multipla_escolha';
    const isRedacao = parsedQuestao.data.tipo === 'redacao';

    const questaoPayload = {
      tipo: parsedQuestao.data.tipo,
      enunciado: parsedQuestao.data.enunciado,
      explicacao: parsedQuestao.data.explicacao ?? null,
      disciplina: parsedQuestao.data.disciplina ?? null,
      assunto: parsedQuestao.data.assunto ?? null,
      nivel: parsedQuestao.data.nivel ?? null,
      ativo: true,
      fonte: parsedQuestao.data.fonte ?? null,
      tags: parsedQuestao.data.tags ?? null,
      resposta_correta: isMultiple ? (parsedQuestao.data.resposta_correta as string) : null,
      resposta_correta_boolean: isVF ? (parsedQuestao.data.resposta_correta as boolean) : null,
      alternativas: isMultiple ? parsedQuestao.data.alternativas : null,
      limite_linhas_min: isRedacao ? parsedQuestao.data.limite_linhas_min ?? null : null,
      limite_linhas_max: isRedacao ? parsedQuestao.data.limite_linhas_max ?? null : null,
      criterios_avaliacao: isRedacao ? parsedQuestao.data.criterios_avaliacao : null
    };

    const { data: created, error: insertError } = await supabaseAdmin.from('questoes').insert(questaoPayload).select('id').single();
    if (insertError || !created) {
      response.erros.push({ indice: index, motivo: insertError?.message ?? 'Erro ao inserir questão.', questao });
      continue;
    }

    const relations = (parsedQuestao.data.concursos ?? []).map((slug) => ({
      questao_id: created.id,
      concurso_id: concursoMap.get(slug)
    }));

    if (relations.length) {
      const { error: relationError } = await supabaseAdmin.from('questao_concurso').insert(relations);
      if (relationError) {
        await supabaseAdmin.from('questoes').delete().eq('id', created.id);
        response.erros.push({ indice: index, motivo: relationError.message, questao });
        continue;
      }
    }

    response.inseridas += 1;
  }

  return NextResponse.json(response);
}
