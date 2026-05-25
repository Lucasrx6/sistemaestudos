-- Schema do sistema de estudo para concursos públicos

CREATE TABLE IF NOT EXISTS concursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nome text NOT NULL,
  banca text,
  ano int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  nome text NOT NULL,
  telefone text,
  concurso_ativo uuid REFERENCES concursos(id),
  preferencia_envio text DEFAULT 'ambos',
  notificacoes_ativas boolean DEFAULT true,
  horario_inicio time,
  horario_fim time,
  envios_por_dia int DEFAULT 2,
  perguntas_por_envio int DEFAULT 3,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  enunciado text NOT NULL,
  resposta_correta text,
  resposta_correta_boolean boolean,
  alternativas jsonb,
  explicacao text,
  disciplina text,
  assunto text,
  nivel text,
  ativo boolean DEFAULT true,
  limite_linhas_min int,
  limite_linhas_max int,
  criterios_avaliacao jsonb,
  fonte text,
  tags jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questao_concurso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questao_id uuid REFERENCES questoes(id) ON DELETE CASCADE,
  concurso_id uuid REFERENCES concursos(id) ON DELETE CASCADE,
  UNIQUE (questao_id, concurso_id)
);

CREATE TABLE IF NOT EXISTS respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  questao_id uuid REFERENCES questoes(id) ON DELETE CASCADE,
  resposta text,
  correta boolean,
  nota_redacao numeric,
  feedback_ia jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fila_revisao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  questao_id uuid REFERENCES questoes(id) ON DELETE CASCADE,
  prioridade int DEFAULT 1,
  atualizada_em timestamptz DEFAULT now(),
  UNIQUE (usuario_id, questao_id)
);

CREATE TABLE IF NOT EXISTS envios_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  token_unico uuid NOT NULL UNIQUE,
  status text DEFAULT 'pendente',
  conteudo jsonb,
  enviado_em timestamptz,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS redacoes_temas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo text,
  enunciado text,
  contexto text,
  tres_aspectos jsonb,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS logs_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte text NOT NULL,
  endpoint text NOT NULL,
  payload jsonb,
  resposta jsonb,
  erro text,
  criado_em timestamptz DEFAULT now()
);

-- View de questões priorizadas: expõe usuario_id e prioridade para filtro no app
CREATE OR REPLACE VIEW vw_questoes_prioritarias AS
SELECT
  f.usuario_id,
  f.prioridade,
  f.atualizada_em,
  q.id,
  q.tipo,
  q.enunciado,
  q.resposta_correta,
  q.resposta_correta_boolean,
  q.alternativas,
  q.explicacao,
  q.disciplina,
  q.assunto,
  q.nivel,
  q.ativo,
  q.limite_linhas_min,
  q.limite_linhas_max,
  q.criterios_avaliacao,
  q.fonte,
  q.tags,
  q.created_at
FROM fila_revisao f
JOIN questoes q ON q.id = f.questao_id
WHERE q.ativo = TRUE
ORDER BY f.prioridade DESC, f.atualizada_em ASC;

-- View de estatísticas por usuário
CREATE OR REPLACE VIEW vw_estatisticas_usuario AS
SELECT
  r.usuario_id,
  COUNT(*) FILTER (WHERE r.correta = TRUE) AS total_acertos,
  COUNT(*) FILTER (WHERE r.correta = FALSE) AS total_erros,
  COUNT(*) AS total_respostas,
  ROUND(AVG(CASE WHEN r.correta THEN 1.0 ELSE 0.0 END) * 100, 1) AS taxa_acerto,
  COUNT(DISTINCT DATE(r.created_at AT TIME ZONE 'America/Sao_Paulo')) AS dias_estudados
FROM respostas r
GROUP BY r.usuario_id;

-- Trigger: atualiza fila de revisão a cada resposta
CREATE OR REPLACE FUNCTION atualiza_fila_revisao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.correta = FALSE THEN
    -- Incrementa prioridade para questões erradas (máximo 10)
    INSERT INTO fila_revisao (usuario_id, questao_id, prioridade, atualizada_em)
    VALUES (NEW.usuario_id, NEW.questao_id, 1, now())
    ON CONFLICT (usuario_id, questao_id)
    DO UPDATE SET
      prioridade = LEAST(fila_revisao.prioridade + 1, 10),
      atualizada_em = now();
  ELSIF NEW.correta = TRUE THEN
    -- Remove da fila quando acerta
    DELETE FROM fila_revisao
    WHERE usuario_id = NEW.usuario_id AND questao_id = NEW.questao_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualiza_fila_revisao ON respostas;
CREATE TRIGGER trigger_atualiza_fila_revisao
AFTER INSERT ON respostas
FOR EACH ROW EXECUTE FUNCTION atualiza_fila_revisao();

-- Row Level Security
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila_revisao ENABLE ROW LEVEL SECURITY;
ALTER TABLE envios_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE redacoes_temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questao_concurso ENABLE ROW LEVEL SECURITY;
ALTER TABLE concursos ENABLE ROW LEVEL SECURITY;

-- Políticas de usuários
CREATE POLICY usuarios_select_self ON usuarios FOR SELECT USING (auth.uid() = id);
CREATE POLICY usuarios_update_self ON usuarios FOR UPDATE USING (auth.uid() = id);
CREATE POLICY usuarios_insert_auth ON usuarios FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas de respostas
CREATE POLICY respostas_own ON respostas FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

-- Políticas de fila de revisão
CREATE POLICY fila_revisao_select_self ON fila_revisao FOR SELECT USING (auth.uid() = usuario_id);

-- Políticas de envios WhatsApp
CREATE POLICY envios_whatsapp_select_self ON envios_whatsapp FOR SELECT USING (auth.uid() = usuario_id);

-- Políticas de temas de redação
CREATE POLICY redacoes_temas_own ON redacoes_temas FOR ALL USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

-- Políticas de questões (visíveis para todos autenticados se ativas)
CREATE POLICY questoes_select_public ON questoes FOR SELECT USING (ativo = TRUE);

-- Políticas de questao_concurso (leitura pública)
CREATE POLICY questao_concurso_select_public ON questao_concurso FOR SELECT USING (TRUE);

-- Políticas de concursos (leitura pública)
CREATE POLICY concursos_select_public ON concursos FOR SELECT USING (TRUE);
