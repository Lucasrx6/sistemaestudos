import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { selecionarQuestoes, type Questao } from '@/lib/utils/selecionar-questoes';
import { enviarMensagens, dividirMensagem } from '@/lib/evolution/client';
import { gerarSlots, dentroDoSlot, agendaBrasilia } from '@/lib/utils/intervalos-aleatorios';
import { v4 as uuidv4 } from 'uuid';

function montarMensagemWhatsapp(questoes: Questao[], token: string, preferencia: string, appUrl: string): string[] {
  const link = `${appUrl}/responder/${token}`;
  const cabecalho = `📚 *Hora de estudar!* Você tem ${questoes.length} questão(ões) para responder.\n\n`;

  if (preferencia === 'link_site') {
    return [`${cabecalho}👆 Acesse o link para responder:\n${link}\n\n_O link expira em 7 dias._`];
  }

  // Monta questões no corpo da mensagem
  const linhas: string[] = [cabecalho];
  questoes.forEach((q, idx) => {
    linhas.push(`*Questão ${idx + 1}* — ${q.disciplina ?? 'Geral'}`);
    linhas.push(q.enunciado);
    linhas.push('');

    if (q.tipo === 'verdadeiro_falso') {
      linhas.push('Responda: V (Verdadeiro) ou F (Falso)');
    } else if (q.tipo === 'multipla_escolha' && Array.isArray(q.alternativas)) {
      for (const alt of q.alternativas as { letra: string; texto: string }[]) {
        linhas.push(`  ${alt.letra}) ${alt.texto}`);
      }
      linhas.push('Responda com a letra da alternativa correta (ex: A, B, C...)');
    } else {
      linhas.push('Questão de redação — acesse o link para responder.');
    }
    linhas.push('');
  });

  if (preferencia === 'ambos') {
    linhas.push(`\nOu acesse o link: ${link}`);
  }

  linhas.push(`\nPara responder aqui, envie no formato:\n1V 2F (para V/F) ou 1A 2C (para múltipla escolha)`);

  const texto = linhas.join('\n');
  return dividirMensagem(texto, 4000);
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const agora = agendaBrasilia();
  const hoje = agora.toISOString().split('T')[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Busca usuários com notificações ativas e telefone cadastrado
  const { data: usuarios, error: usuariosError } = await supabase
    .from('usuarios')
    .select('id, telefone, preferencia_envio, horario_inicio, horario_fim, envios_por_dia, perguntas_por_envio, notificacoes_ativas')
    .eq('notificacoes_ativas', true)
    .not('telefone', 'is', null);

  if (usuariosError) {
    return NextResponse.json({ error: usuariosError.message }, { status: 500 });
  }

  const resultados: Array<{ usuario_id: string; status: string; motivo?: string }> = [];

  for (const usuario of usuarios ?? []) {
    if (!usuario.horario_inicio || !usuario.horario_fim || !usuario.telefone) continue;

    // Quantos envios já foram feitos hoje para este usuário
    const { count: enviosHoje } = await supabase
      .from('envios_whatsapp')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuario.id)
      .gte('criado_em', `${hoje}T00:00:00-03:00`)
      .neq('status', 'erro');

    const totalEnvios = enviosHoje ?? 0;
    if (totalEnvios >= usuario.envios_por_dia) {
      resultados.push({ usuario_id: usuario.id, status: 'ignorado', motivo: 'limite_diario' });
      continue;
    }

    // Gera os slots para hoje e verifica se algum está próximo do horário atual
    const slots = gerarSlots(usuario.horario_inicio, usuario.horario_fim, usuario.envios_por_dia, agora);
    const slotAtivo = slots.find((slot) => dentroDoSlot(slot, agora, 7));

    if (!slotAtivo) {
      resultados.push({ usuario_id: usuario.id, status: 'ignorado', motivo: 'fora_do_slot' });
      continue;
    }

    // Verifica se já houve envio nos últimos 15 minutos (evita duplicata por execuções sobrepostas)
    const quinzeMinAtras = new Date(agora.getTime() - 15 * 60 * 1000).toISOString();
    const { count: envioRecente } = await supabase
      .from('envios_whatsapp')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuario.id)
      .gte('criado_em', quinzeMinAtras)
      .neq('status', 'erro');

    if ((envioRecente ?? 0) > 0) {
      resultados.push({ usuario_id: usuario.id, status: 'ignorado', motivo: 'envio_recente' });
      continue;
    }

    // Seleciona questões
    let questoes: Questao[] = [];
    try {
      questoes = await selecionarQuestoes(usuario.id, usuario.perguntas_por_envio ?? 3);
    } catch (err) {
      resultados.push({ usuario_id: usuario.id, status: 'erro', motivo: `selecionar_questoes: ${err}` });
      continue;
    }

    if (questoes.length === 0) {
      resultados.push({ usuario_id: usuario.id, status: 'ignorado', motivo: 'sem_questoes' });
      continue;
    }

    const token = uuidv4();

    // Cria registro de envio
    const { error: insertError } = await supabase.from('envios_whatsapp').insert({
      usuario_id: usuario.id,
      token_unico: token,
      status: 'enviando',
      conteudo: { questao_ids: questoes.map((q) => q.id) },
      enviado_em: new Date().toISOString()
    });

    if (insertError) {
      resultados.push({ usuario_id: usuario.id, status: 'erro', motivo: insertError.message });
      continue;
    }

    // Monta e envia mensagem
    const mensagens = montarMensagemWhatsapp(questoes, token, usuario.preferencia_envio ?? 'ambos', appUrl);

    try {
      await enviarMensagens(usuario.telefone, mensagens);

      await supabase
        .from('envios_whatsapp')
        .update({ status: 'enviado' })
        .eq('token_unico', token);

      // Log
      await supabase.from('logs_externos').insert({
        fonte: 'cron_envios',
        endpoint: 'evolution/sendText',
        payload: { usuario_id: usuario.id, questoes_count: questoes.length },
        resposta: { mensagens_count: mensagens.length }
      });

      resultados.push({ usuario_id: usuario.id, status: 'enviado' });
    } catch (err) {
      await supabase
        .from('envios_whatsapp')
        .update({ status: 'erro' })
        .eq('token_unico', token);

      await supabase.from('logs_externos').insert({
        fonte: 'cron_envios',
        endpoint: 'evolution/sendText',
        payload: { usuario_id: usuario.id },
        erro: String(err)
      });

      resultados.push({ usuario_id: usuario.id, status: 'erro', motivo: String(err) });
    }
  }

  return NextResponse.json({ ok: true, processados: resultados.length, resultados });
}
