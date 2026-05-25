import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = getSupabaseAdmin();
  
  // Usar uma query raw RPC ou groupBy é preferível, mas via postgrest puro,
  // vamos trazer as disciplinas não nulas. Em bases pequenas isso é rápido, 
  // mas o ideal é criar uma view ou RPC.
  // Como alternativa simples, buscamos distinct on disciplina se suportado, ou agrupamos.
  
  try {
    const { data: qData, error: qError } = await supabase
      .from('questoes')
      .select('disciplina')
      .eq('ativo', true)
      .not('disciplina', 'is', null)
      .limit(5000);
      
    if (qError) throw qError;
    
    const setDisciplinas = new Set((qData ?? []).map((q: any) => q.disciplina).filter(Boolean));
    const disciplinas = Array.from(setDisciplinas).sort();
    
    return NextResponse.json({ ok: true, disciplinas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao buscar disciplinas' }, { status: 500 });
  }
}
