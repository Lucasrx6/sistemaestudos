import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }

  const usuarioId = userData.user.id;

  // Estatísticas gerais
  const { data: stats } = await supabase
    .from('vw_estatisticas_usuario')
    .select('*')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  // Sequência de dias estudando (streak)
  const { data: diasData } = await supabase
    .from('respostas')
    .select('created_at')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(200);

  const diasUnicos = Array.from(new Set(
    (diasData ?? []).map((r: { created_at: string }) =>
      new Date(r.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    )
  ));

  let streak = 0;
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [d, m, y] = hoje.split('/').map(Number);
  let dataRef = new Date(y, m - 1, d);

  for (const dia of diasUnicos) {
    const dataRef2 = dataRef.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    if (dia === dataRef2) {
      streak++;
      dataRef = new Date(dataRef.getTime() - 86400000);
    } else {
      break;
    }
  }

  // Evolução nos últimos 14 dias
  const quatorzeAtras = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data: evolucaoData } = await supabase
    .from('respostas')
    .select('created_at, correta')
    .eq('usuario_id', usuarioId)
    .gte('created_at', quatorzeAtras)
    .order('created_at', { ascending: true });

  const evolucaoPorDia: Record<string, { acertos: number; total: number }> = {};
  for (const r of evolucaoData ?? []) {
    const dia = new Date(r.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    if (!evolucaoPorDia[dia]) evolucaoPorDia[dia] = { acertos: 0, total: 0 };
    evolucaoPorDia[dia].total++;
    if (r.correta) evolucaoPorDia[dia].acertos++;
  }

  // Questões mais erradas (top 5)
  const { data: maisErradas } = await supabase
    .from('respostas')
    .select('questao_id, questoes(enunciado, disciplina)')
    .eq('usuario_id', usuarioId)
    .eq('correta', false);

  const contagem: Record<string, { enunciado: string; disciplina: string | null; count: number }> = {};
  for (const r of maisErradas ?? []) {
    const q = (Array.isArray(r.questoes) ? r.questoes[0] : r.questoes) as { enunciado: string; disciplina: string | null } | null;
    if (!q) continue;
    if (!contagem[r.questao_id]) contagem[r.questao_id] = { enunciado: q.enunciado, disciplina: q.disciplina, count: 0 };
    contagem[r.questao_id].count++;
  }

  const topErradas = Object.values(contagem)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return NextResponse.json({
    ok: true,
    stats: {
      total_acertos: Number(stats?.total_acertos ?? 0),
      total_erros: Number(stats?.total_erros ?? 0),
      total_respostas: Number(stats?.total_respostas ?? 0),
      taxa_acerto: Number(stats?.taxa_acerto ?? 0),
      dias_estudados: Number(stats?.dias_estudados ?? 0),
      streak
    },
    evolucao: Object.entries(evolucaoPorDia).map(([dia, v]) => ({ dia, ...v })),
    top_erradas: topErradas
  });
}
