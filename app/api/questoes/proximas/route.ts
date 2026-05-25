import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { selecionarQuestoes } from '@/lib/utils/selecionar-questoes';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawLimit = searchParams.get('limit');
  const limit = rawLimit ? Math.min(Math.max(Number(rawLimit), 1), 50) : undefined;

  // Extrai token de autenticação do header Authorization
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Valida o token e obtém o usuário
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }

  const usuarioId = userData.user.id;

  try {
    const questoes = await selecionarQuestoes(usuarioId, limit);
    return NextResponse.json({ ok: true, questoes });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao selecionar questões.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
