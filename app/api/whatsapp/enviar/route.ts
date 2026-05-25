import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { selecionarQuestoes, type Questao } from '@/lib/utils/selecionar-questoes';
import { enviarMensagens, dividirMensagem } from '@/lib/evolution/client';
import { v4 as uuidv4 } from 'uuid';

// Disparo manual para um usuário específico (usado para teste ou reenvio)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { usuario_id } = body;

  if (!usuario_id) {
    return NextResponse.json({ error: 'usuario_id é obrigatório.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id, telefone, preferencia_envio, perguntas_por_envio, notificacoes_ativas')
    .eq('id', usuario_id)
    .single();

  if (usuarioError || !usuario) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  if (!usuario.telefone) {
    return NextResponse.json({ error: 'Usuário sem telefone cadastrado.' }, { status: 400 });
  }

  let questoes: Questao[] = [];
  try {
    questoes = await selecionarQuestoes(usuario.id, usuario.perguntas_por_envio ?? 3);
  } catch (err) {
    return NextResponse.json({ error: `Erro ao selecionar questões: ${err}` }, { status: 500 });
  }

  if (questoes.length === 0) {
    return NextResponse.json({ ok: false, message: 'Nenhuma questão disponível.' });
  }

  const token = uuidv4();

  const { error: insertError } = await supabase.from('envios_whatsapp').insert({
    usuario_id: usuario.id,
    token_unico: token,
    status: 'enviando',
    conteudo: { questao_ids: questoes.map((q) => q.id) },
    enviado_em: new Date().toISOString()
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const link = `${appUrl}/responder/${token}`;
  const preferencia = usuario.preferencia_envio ?? 'ambos';

  const cabecalho = `📚 *Sessão de estudo!* ${questoes.length} questão(ões) para você.\n\n`;
  const linhas: string[] = [cabecalho];

  if (preferencia !== 'link_site') {
    questoes.forEach((q, idx) => {
      linhas.push(`*Questão ${idx + 1}* — ${q.disciplina ?? 'Geral'}`);
      linhas.push(q.enunciado);
      linhas.push('');
      if (q.tipo === 'verdadeiro_falso') {
        linhas.push('V (Verdadeiro) ou F (Falso)');
      } else if (q.tipo === 'multipla_escolha' && Array.isArray(q.alternativas)) {
        for (const alt of q.alternativas as { letra: string; texto: string }[]) {
          linhas.push(`  ${alt.letra}) ${alt.texto}`);
        }
        linhas.push('Responda com a letra da alternativa');
      } else {
        linhas.push('Questão de redação — use o link abaixo.');
      }
      linhas.push('');
    });
    linhas.push('Responda no formato: 1V 2F 3A (número + resposta)');
  }

  if (preferencia !== 'whatsapp_direto') {
    linhas.push(`\n🔗 Link: ${link}`);
  }

  const mensagens = dividirMensagem(linhas.join('\n'), 4000);

  try {
    await enviarMensagens(usuario.telefone, mensagens);

    await supabase
      .from('envios_whatsapp')
      .update({ status: 'enviado' })
      .eq('token_unico', token);

    await supabase.from('logs_externos').insert({
      fonte: 'api_enviar_manual',
      endpoint: 'evolution/sendText',
      payload: { usuario_id: usuario.id, questoes_count: questoes.length },
      resposta: { ok: true }
    });

    return NextResponse.json({ ok: true, token, questoes_count: questoes.length });
  } catch (err) {
    await supabase
      .from('envios_whatsapp')
      .update({ status: 'erro' })
      .eq('token_unico', token);

    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
