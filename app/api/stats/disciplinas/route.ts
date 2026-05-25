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

  const { data: respostas } = await supabase
    .from('respostas')
    .select('correta, questoes(disciplina)')
    .eq('usuario_id', usuarioId)
    .not('correta', 'is', null);

  const mapa: Record<string, { acertos: number; erros: number }> = {};
  for (const r of respostas ?? []) {
    const disc = (r.questoes as { disciplina?: string | null } | null)?.disciplina ?? 'Sem disciplina';
    if (!mapa[disc]) mapa[disc] = { acertos: 0, erros: 0 };
    if (r.correta) mapa[disc].acertos++;
    else mapa[disc].erros++;
  }

  const disciplinas = Object.entries(mapa)
    .map(([disciplina, { acertos, erros }]) => ({
      disciplina,
      acertos,
      erros,
      taxa: acertos + erros > 0 ? Math.round((acertos / (acertos + erros)) * 100) : 0
    }))
    .sort((a, b) => b.acertos + b.erros - (a.acertos + a.erros));

  return NextResponse.json({ ok: true, disciplinas });
}
