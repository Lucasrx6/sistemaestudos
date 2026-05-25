import { getSupabaseAdmin } from '@/lib/supabase/admin';

export type Questao = {
  id: string;
  tipo: string;
  enunciado: string;
  alternativas: unknown;
  resposta_correta: string | null;
  resposta_correta_boolean: boolean | null;
  explicacao: string | null;
  disciplina: string | null;
  assunto: string | null;
  nivel: string | null;
  limite_linhas_min: number | null;
  limite_linhas_max: number | null;
  criterios_avaliacao: unknown;
};

function shuffle<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export async function selecionarQuestoes(usuarioId: string, limit?: number): Promise<Questao[]> {
  const supabase = getSupabaseAdmin();

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('concursos_ativos, questoes_por_sessao, disciplinas_selecionadas')
    .eq('id', usuarioId)
    .single();

  const concursosAtivos: string[] = usuario?.concursos_ativos ?? [];
  const disciplinasAtivas: string[] = usuario?.disciplinas_selecionadas ?? [];
  const quantidade = limit ?? usuario?.questoes_por_sessao ?? 10;

  // Últimas 5 questões respondidas (para não repetir)
  const { data: historico } = await supabase
    .from('respostas')
    .select('questao_id')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(5);

  const ultimasIds = (historico ?? []).map((r: { questao_id: string }) => r.questao_id);

  let targetRevisao = Math.max(1, Math.floor(quantidade * 0.6));
  let targetNovas = Math.max(1, Math.floor(quantidade * 0.3));
  let targetEspacada = Math.max(0, quantidade - targetRevisao - targetNovas);

  // --- Bucket 1: Fila de revisão (questões mais erradas) ---
  let revisaoQuery = supabase
    .from('vw_questoes_prioritarias')
    .select('*')
    .eq('usuario_id', usuarioId)
    .in('tipo', ['verdadeiro_falso', 'multipla_escolha'])
    .limit(targetRevisao * 5); // Busca mais para poder embaralhar

  if (ultimasIds.length > 0) {
    revisaoQuery = revisaoQuery.not('id', 'in', `(${ultimasIds.join(',')})`);
  }
  if (disciplinasAtivas.length > 0) {
    revisaoQuery = revisaoQuery.in('disciplina', disciplinasAtivas);
  }

  const { data: revisaoData } = await revisaoQuery;
  const revisao = shuffle((revisaoData ?? []) as Questao[]).slice(0, targetRevisao);
  
  // Calcula sobras da Revisão e repassa para Novas
  const sobraRevisao = targetRevisao - revisao.length;
  if (sobraRevisao > 0) {
    targetNovas += sobraRevisao;
  }

  // --- Bucket 3: Revisão espaçada (acertadas há mais de 3 dias) ---
  // Fazemos a espaçada antes das novas para repassar sobras também
  let espacadaQuestoes: Questao[] = [];
  if (targetEspacada > 0) {
    const tresDiasAtras = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();

    let espacadaQuery = supabase
      .from('respostas')
      .select('questao_id, questoes(*)')
      .eq('usuario_id', usuarioId)
      .eq('correta', true)
      .lt('created_at', tresDiasAtras)
      .limit(targetEspacada * 10);

    const { data: espacadaData } = await espacadaQuery;

    let espacadaRaw = (espacadaData ?? [])
      .map((r: { questoes: unknown }) => r.questoes)
      .filter((q): q is Questao => q !== null && typeof q === 'object');
      
    if (disciplinasAtivas.length > 0) {
      espacadaRaw = espacadaRaw.filter(q => q.disciplina && disciplinasAtivas.includes(q.disciplina));
    }

    espacadaQuestoes = shuffle(espacadaRaw).slice(0, targetEspacada);
    
    // Sobras da Espaçada vão para Novas
    const sobraEspacada = targetEspacada - espacadaQuestoes.length;
    if (sobraEspacada > 0) {
      targetNovas += sobraEspacada;
    }
  }

  // --- Bucket 2: Questões Novas ---
  const { data: todasRespondidas } = await supabase
    .from('respostas')
    .select('questao_id')
    .eq('usuario_id', usuarioId);

  const respondidosIds = (todasRespondidas ?? []).map((r: { questao_id: string }) => r.questao_id);

  let novasQuery = supabase
    .from('questoes')
    .select('*')
    .eq('ativo', true)
    .in('tipo', ['verdadeiro_falso', 'multipla_escolha'])
    .limit(targetNovas * 5); // Busca mais para evitar falta pós-filtros

  if (respondidosIds.length > 0) {
    novasQuery = novasQuery.not('id', 'in', `(${respondidosIds.join(',')})`);
  }
  if (disciplinasAtivas.length > 0) {
    novasQuery = novasQuery.in('disciplina', disciplinasAtivas);
  }

  if (concursosAtivos.length > 0) {
    const { data: questaosConcurso } = await supabase
      .from('questao_concurso')
      .select('questao_id')
      .in('concurso_id', concursosAtivos);

    const idsNoConcurso = (questaosConcurso ?? []).map((qc: { questao_id: string }) => qc.questao_id);
    if (idsNoConcurso.length > 0) {
      novasQuery = novasQuery.in('id', idsNoConcurso);
    }
  }

  const { data: novasData } = await novasQuery;
  const novas = shuffle((novasData ?? []) as Questao[]).slice(0, targetNovas);

  // Junta e embaralha os 3 buckets
  const todasIds = new Set<string>();
  const resultado: Questao[] = [];

  for (const q of [...revisao, ...espacadaQuestoes, ...novas]) {
    if (!todasIds.has(q.id)) {
      todasIds.add(q.id);
      resultado.push(q);
    }
  }

  return shuffle(resultado).slice(0, quantidade);
}
