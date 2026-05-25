import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const respostaSchema = z.object({
  usuario_id: z.string().uuid(),
  questao_id: z.string().uuid(),
  resposta: z.union([z.string(), z.boolean()]).nullable(),
  nota_redacao: z.number().min(0).max(10).optional().nullable(),
  feedback_ia: z.any().optional().nullable()
});

function parseBooleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (normalized === 'true' || normalized === 'v') return true;
    if (normalized === 'false' || normalized === 'f') return false;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = respostaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { usuario_id, questao_id, resposta, nota_redacao, feedback_ia } = parsed.data;
  const supabase = getSupabaseAdmin();

  const { data: questao, error: questaoError } = await supabase
    .from('questoes')
    .select('id, tipo, resposta_correta, resposta_correta_boolean, explicacao')
    .eq('id', questao_id)
    .single();

  if (questaoError || !questao) {
    return NextResponse.json({ error: 'Questão não encontrada.' }, { status: 404 });
  }

  let correta: boolean | null = null;

  if (questao.tipo === 'verdadeiro_falso') {
    const respostaBoolean = parseBooleanValue(resposta);
    if (respostaBoolean === null) {
      return NextResponse.json({ error: 'Resposta inválida para questão verdadeiro/falso.' }, { status: 400 });
    }
    correta = respostaBoolean === Boolean(questao.resposta_correta_boolean);
  } else if (questao.tipo === 'multipla_escolha') {
    if (typeof resposta !== 'string' || !resposta.trim()) {
      return NextResponse.json({ error: 'Informe uma alternativa válida.' }, { status: 400 });
    }
    correta = resposta.trim().toUpperCase() === String(questao.resposta_correta ?? '').toUpperCase();
  }
  // redacao: correta permanece null

  // Insere resposta — o trigger do banco atualiza fila_revisao automaticamente
  const { data: respostaCriada, error: insertError } = await supabase
    .from('respostas')
    .insert({
      usuario_id,
      questao_id,
      resposta: resposta === null ? null : String(resposta),
      correta,
      nota_redacao: nota_redacao ?? null,
      feedback_ia: feedback_ia ?? null
    })
    .select('id, correta, created_at')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    resposta: respostaCriada,
    correta,
    explicacao: questao.explicacao ?? null
  });
}
