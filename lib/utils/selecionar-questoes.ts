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

export async function selecionarQuestoes(usuarioId: string, quantidade = 3): Promise<Questao[]> {
  const supabase = getSupabaseAdmin();

  // Busca perfil do usuário para obter concurso_ativo
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('concurso_ativo')
    .eq('id', usuarioId)
    .single();

  const concursoAtivo = usuario?.concurso_ativo ?? null;

  // Últimas 5 questões respondidas (para não repetir)
  const { data: historico } = await supabase
    .from('respostas')
    .select('questao_id')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(5);

  const ultimasIds = (historico ?? []).map((r: { questao_id: string }) => r.questao_id);

  const bucketRevisao = Math.max(1, Math.floor(quantidade * 0.6));
  const bucketNovas = Math.max(1, Math.floor(quantidade * 0.3));
  const bucketEspacada = Math.max(0, quantidade - bucketRevisao - bucketNovas);

  // --- Bucket 1: 60% — fila de revisão (questões mais erradas) ---
  let revisaoQuery = supabase
    .from('vw_questoes_prioritarias')
    .select('*')
    .eq('usuario_id', usuarioId)
    .in('tipo', ['verdadeiro_falso', 'multipla_escolha'])
    .limit(bucketRevisao * 3);

  if (ultimasIds.length > 0) {
    revisaoQuery = revisaoQuery.not('id', 'in', `(${ultimasIds.join(',')})`);
  }

  const { data: revisaoData } = await revisaoQuery;
  const revisao = shuffle((revisaoData ?? []) as Questao[]).slice(0, bucketRevisao);

  // --- Bucket 2: 30% — questões novas (nunca respondidas) do concurso ativo ---
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
    .limit(bucketNovas * 5);

  if (respondidosIds.length > 0) {
    novasQuery = novasQuery.not('id', 'in', `(${respondidosIds.join(',')})`);
  }

  // Filtra pelo concurso ativo via questao_concurso
  if (concursoAtivo) {
    const { data: questaosConcurso } = await supabase
      .from('questao_concurso')
      .select('questao_id')
      .eq('concurso_id', concursoAtivo);

    const idsNoConcurso = (questaosConcurso ?? []).map((qc: { questao_id: string }) => qc.questao_id);
    if (idsNoConcurso.length > 0) {
      novasQuery = novasQuery.in('id', idsNoConcurso);
    }
  }

  const { data: novasData } = await novasQuery;
  const novas = shuffle((novasData ?? []) as Questao[]).slice(0, bucketNovas);

  // --- Bucket 3: 10% — revisão espaçada (acertadas há mais de 3 dias) ---
  let espacadaQuestoes: Questao[] = [];
  if (bucketEspacada > 0) {
    const tresDiasAtras = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();

    const { data: espacadaData } = await supabase
      .from('respostas')
      .select('questao_id, questoes(*)')
      .eq('usuario_id', usuarioId)
      .eq('correta', true)
      .lt('created_at', tresDiasAtras) // mais de 3 dias atrás
      .limit(bucketEspacada * 5);

    const espacadaRaw = (espacadaData ?? [])
      .map((r: { questoes: unknown }) => r.questoes)
      .filter((q): q is Questao => q !== null && typeof q === 'object');

    espacadaQuestoes = shuffle(espacadaRaw).slice(0, bucketEspacada);
  }

  // Junta e embaralha os 3 buckets
  const todasIds = new Set<string>();
  const resultado: Questao[] = [];

  for (const q of [...revisao, ...novas, ...espacadaQuestoes]) {
    if (!todasIds.has(q.id)) {
      todasIds.add(q.id);
      resultado.push(q);
    }
  }

  return shuffle(resultado).slice(0, quantidade);
}
