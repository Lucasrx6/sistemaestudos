import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

interface Params {
  params: { token: string };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = params;

  if (!token) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: envio, error } = await supabase
    .from('envios_whatsapp')
    .select('id, usuario_id, token_unico, status, conteudo, criado_em')
    .eq('token_unico', token)
    .maybeSingle();

  if (error || !envio) {
    return NextResponse.json({ error: 'Envio não encontrado.' }, { status: 404 });
  }

  // Token expira em 7 dias
  const setesDias = 7 * 24 * 60 * 60 * 1000;
  if (new Date().getTime() - new Date(envio.criado_em).getTime() > setesDias) {
    return NextResponse.json({ error: 'Este link expirou (7 dias).' }, { status: 410 });
  }

  // Busca questões do envio
  const questaoIds: string[] = (envio.conteudo as { questao_ids?: string[] })?.questao_ids ?? [];
  if (questaoIds.length === 0) {
    return NextResponse.json({ error: 'Nenhuma questão neste envio.' }, { status: 404 });
  }

  const { data: questoes, error: questoesError } = await supabase
    .from('questoes')
    .select('id, tipo, enunciado, alternativas, disciplina, assunto, nivel, limite_linhas_min, limite_linhas_max, criterios_avaliacao')
    .in('id', questaoIds);

  if (questoesError || !questoes) {
    return NextResponse.json({ error: 'Erro ao buscar questões.' }, { status: 500 });
  }

  // Reordena conforme ordem original do envio
  const questoesOrdenadas = questaoIds
    .map((id) => questoes.find((q) => q.id === id))
    .filter(Boolean);

  return NextResponse.json({
    ok: true,
    envio: {
      id: envio.id,
      usuario_id: envio.usuario_id,
      status: envio.status,
      criado_em: envio.criado_em
    },
    questoes: questoesOrdenadas
  });
}
