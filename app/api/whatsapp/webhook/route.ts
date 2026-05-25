import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { enviarTexto } from '@/lib/evolution/client';

type QuestaoEnvio = {
  id: string;
  tipo: string;
  enunciado: string;
  resposta_correta: string | null;
  resposta_correta_boolean: boolean | null;
  explicacao: string | null;
};

// Faz parsing permissivo de respostas enviadas pelo WhatsApp
// Aceita: "1V 2F 3V", "V F V", "1A 2C 3B", "1-V, 2-F", "A B C"
function parsearRespostas(texto: string, totalQuestoes: number): (string | null)[] {
  const normalizado = texto.trim().toUpperCase();

  // Tenta formato numerado: "1V 2F", "1A 2C", "1-V, 2-F"
  const numeradoRegex = /(\d+)\s*[-–]?\s*([VFTABCDE])/g;
  const numerados = [...normalizado.matchAll(numeradoRegex)];
  if (numerados.length > 0) {
    const mapa: Record<number, string> = {};
    for (const match of numerados) {
      mapa[parseInt(match[1])] = match[2];
    }
    return Array.from({ length: totalQuestoes }, (_, i) => mapa[i + 1] ?? null);
  }

  // Tenta sequência simples: "V F V" ou "A B C"
  const tokens = normalizado.split(/[\s,;]+/).filter((t) => /^[VFTABCDE]$/.test(t));
  if (tokens.length > 0) {
    return Array.from({ length: totalQuestoes }, (_, i) => tokens[i] ?? null);
  }

  return Array.from({ length: totalQuestoes }, () => null);
}

function normalizeResposta(raw: string | null, tipo: string): string | boolean | null {
  if (!raw) return null;
  if (tipo === 'verdadeiro_falso') {
    if (raw === 'V' || raw === 'T') return 'true';
    if (raw === 'F') return 'false';
    return null;
  }
  return raw; // letra da alternativa para múltipla escolha
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Extrai dados do evento do Evolution API
  // Estrutura esperada: { data: { key: { remoteJid }, message: { conversation } } }
  const evento = body as Record<string, unknown>;
  const data = evento?.data as Record<string, unknown> | undefined;
  const key = data?.key as Record<string, unknown> | undefined;
  const remoteJid = (key?.remoteJid as string) ?? '';
  const mensagemTexto = (
    (data?.message as Record<string, unknown>)?.conversation as string
    ?? (data?.message as Record<string, unknown>)?.extendedTextMessage as string
    ?? ''
  ).trim();

  if (!remoteJid || !mensagemTexto) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // Extrai número normalizado do remoteJid (formato: 5511999999999@s.whatsapp.net)
  const numero = remoteJid.replace(/@.*/, '').replace(/\D/g, '');

  if (!numero) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // Busca usuário pelo telefone
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, nome, telefone')
    .ilike('telefone', `%${numero.slice(-10)}%`)
    .maybeSingle();

  if (!usuario) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: 'usuario_nao_encontrado' });
  }

  // Busca último envio pendente/enviado deste usuário
  const { data: envio } = await supabase
    .from('envios_whatsapp')
    .select('id, token_unico, conteudo, criado_em')
    .eq('usuario_id', usuario.id)
    .eq('status', 'enviado')
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!envio) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: 'sem_envio_pendente' });
  }

  // Verifica se o envio expirou (7 dias)
  const setesDias = 7 * 24 * 60 * 60 * 1000;
  if (new Date().getTime() - new Date(envio.criado_em).getTime() > setesDias) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: 'envio_expirado' });
  }

  // Obtém questões do envio
  const questaoIds: string[] = (envio.conteudo as { questao_ids?: string[] })?.questao_ids ?? [];
  if (questaoIds.length === 0) {
    return NextResponse.json({ ok: true, ignorado: true, motivo: 'sem_questoes' });
  }

  const { data: questoes } = await supabase
    .from('questoes')
    .select('id, tipo, enunciado, resposta_correta, resposta_correta_boolean, explicacao')
    .in('id', questaoIds);

  if (!questoes || questoes.length === 0) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // Ordena conforme a ordem original do envio
  const questoesOrdenadas: QuestaoEnvio[] = questaoIds
    .map((id) => questoes.find((q) => q.id === id))
    .filter((q): q is QuestaoEnvio => q !== null);

  // Faz parsing das respostas
  const respostasRaw = parsearRespostas(mensagemTexto, questoesOrdenadas.length);

  let acertos = 0;
  let erros = 0;
  const feedbacks: string[] = [];

  for (let i = 0; i < questoesOrdenadas.length; i++) {
    const questao = questoesOrdenadas[i];
    const respostaRaw = respostasRaw[i];

    if (!respostaRaw || questao.tipo === 'redacao') continue;

    const respostaNorm = normalizeResposta(respostaRaw, questao.tipo);
    if (!respostaNorm) continue;

    let correta: boolean | null = null;
    if (questao.tipo === 'verdadeiro_falso') {
      const respostaBoolean = respostaNorm === 'true';
      correta = respostaBoolean === Boolean(questao.resposta_correta_boolean);
    } else if (questao.tipo === 'multipla_escolha') {
      correta = String(respostaNorm).toUpperCase() === String(questao.resposta_correta ?? '').toUpperCase();
    }

    // Salva resposta no banco (o trigger atualiza fila_revisao automaticamente)
    await supabase.from('respostas').insert({
      usuario_id: usuario.id,
      questao_id: questao.id,
      resposta: String(respostaNorm),
      correta
    });

    if (correta === true) {
      acertos++;
      feedbacks.push(`✅ Q${i + 1}: Correto!`);
    } else if (correta === false) {
      erros++;
      const gabarito = questao.tipo === 'verdadeiro_falso'
        ? (questao.resposta_correta_boolean ? 'Verdadeiro' : 'Falso')
        : questao.resposta_correta ?? '?';
      feedbacks.push(`❌ Q${i + 1}: Incorreto. Gabarito: ${gabarito}${questao.explicacao ? `\n   💡 ${questao.explicacao.slice(0, 120)}` : ''}`);
    }
  }

  // Marca envio como respondido
  await supabase
    .from('envios_whatsapp')
    .update({ status: 'respondido' })
    .eq('id', envio.id);

  // Monta e envia feedback
  const totalRespondidas = acertos + erros;
  if (totalRespondidas === 0) {
    return NextResponse.json({ ok: true, message: 'Nenhuma resposta reconhecida.' });
  }

  const taxa = Math.round((acertos / totalRespondidas) * 100);
  const resumo = `📊 *Resultado:* ${acertos}/${totalRespondidas} corretas (${taxa}%)\n\n${feedbacks.join('\n\n')}`;

  try {
    await enviarTexto(numero, resumo);
  } catch {
    // Feedback falhou mas respostas já foram salvas
  }

  await supabase.from('logs_externos').insert({
    fonte: 'webhook_whatsapp',
    endpoint: 'receber_resposta',
    payload: { usuario_id: usuario.id, texto: mensagemTexto },
    resposta: { acertos, erros, total: totalRespondidas }
  });

  return NextResponse.json({ ok: true, acertos, erros, total: totalRespondidas });
}
