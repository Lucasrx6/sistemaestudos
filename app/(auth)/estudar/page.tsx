'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

type Alternativa = { letra: string; texto: string };

type Questao = {
  id: string;
  tipo: 'verdadeiro_falso' | 'multipla_escolha' | 'redacao';
  enunciado: string;
  alternativas?: Alternativa[];
  explicacao?: string | null;
  disciplina?: string | null;
  assunto?: string | null;
  nivel?: string | null;
  limite_linhas_min?: number | null;
  limite_linhas_max?: number | null;
  criterios_avaliacao?: string[] | null;
};

type Feedback = {
  message: string;
  correta?: boolean | null;
  explicacao?: string | null;
};

export default function EstudarPage() {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resposta, setResposta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [session, setSession] = useState<{ userId: string; token: string } | null>(null);
  const [sessionado, setSessionado] = useState(false);

  const questaoAtual = useMemo(() => questoes[currentIndex] ?? null, [questoes, currentIndex]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession({ userId: data.session.user.id, token: data.session.access_token });
      }
      setSessionado(true);
    });
  }, []);

  const fetchQuestoes = async (token: string) => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch('/api/questoes/proximas?limit=5', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error || 'Não foi possível carregar as questões.');
        setQuestoes([]);
        return;
      }
      setQuestoes(data.questoes || []);
      setCurrentIndex(0);
      setResposta('');
    } catch {
      setError('Erro ao carregar as questões. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) fetchQuestoes(session.token);
  }, [session]);

  const handleSubmit = async () => {
    if (!questaoAtual || !session) return;

    setLoading(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch('/api/questoes/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: session.userId,
          questao_id: questaoAtual.id,
          resposta: questaoAtual.tipo === 'verdadeiro_falso' ? resposta : resposta
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || 'Não foi possível enviar sua resposta.');
        return;
      }

      let message = '';
      if (questaoAtual.tipo === 'redacao') {
        message = 'Redação registrada. Use a seção Redação para correção completa por IA.';
      } else if (data.correta) {
        message = '✓ Resposta correta!';
      } else {
        message = '✗ Resposta incorreta.';
      }

      setFeedback({
        message,
        correta: data.correta ?? null,
        explicacao: questaoAtual.explicacao ?? null
      });

      setResposta('');
    } catch {
      setError('Erro ao enviar resposta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const avancar = () => {
    setCurrentIndex((i) => i + 1);
    setResposta('');
    setFeedback(null);
    setError(null);
  };

  if (!sessionado) {
    return (
      <main className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-0">Estudar</h1>
          <p className="text-muted mb-0 small">Questões priorizadas pelo seu histórico.</p>
        </div>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => session && fetchQuestoes(session.token)}
          disabled={loading}
        >
          <i className="fas fa-sync-alt me-1" /> Nova rodada
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading && !questaoAtual ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando questões...</span>
          </div>
        </div>
      ) : currentIndex >= questoes.length && questoes.length > 0 ? (
        <div className="card shadow-sm p-4 text-center">
          <i className="fas fa-trophy fa-3x text-warning mb-3" />
          <h2 className="h4">Rodada concluída!</h2>
          <p className="text-muted">Você respondeu todas as questões desta sessão.</p>
          <button className="btn btn-primary mt-2" onClick={() => session && fetchQuestoes(session.token)}>
            Nova rodada
          </button>
        </div>
      ) : !questaoAtual ? (
        <div className="card shadow-sm p-4 text-center">
          <p className="text-muted mb-3">Nenhuma questão disponível no momento.</p>
          <button className="btn btn-primary" onClick={() => session && fetchQuestoes(session.token)}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span className="badge bg-secondary">{currentIndex + 1} / {questoes.length}</span>
            <span className="badge bg-info text-dark">{questaoAtual.tipo.replace('_', ' ')}</span>
          </div>
          <div className="card-body">
            {questaoAtual.disciplina && (
              <p className="text-muted small mb-1">
                <i className="fas fa-book me-1" />{questaoAtual.disciplina}
                {questaoAtual.assunto && ` — ${questaoAtual.assunto}`}
                {questaoAtual.nivel && (
                  <span className="ms-2 badge bg-light text-dark">{questaoAtual.nivel}</span>
                )}
              </p>
            )}

            <p className="fs-5 mt-2 mb-4">{questaoAtual.enunciado}</p>

            {questaoAtual.tipo === 'verdadeiro_falso' && !feedback && (
              <div className="d-flex gap-3 mb-4">
                {['true', 'false'].map((val) => (
                  <div className="form-check" key={val}>
                    <input
                      className="form-check-input"
                      type="radio"
                      name="resposta"
                      id={`vf-${val}`}
                      value={val}
                      checked={resposta === val}
                      onChange={(e) => setResposta(e.target.value)}
                    />
                    <label className="form-check-label" htmlFor={`vf-${val}`}>
                      {val === 'true' ? 'Verdadeiro' : 'Falso'}
                    </label>
                  </div>
                ))}
              </div>
            )}

            {questaoAtual.tipo === 'multipla_escolha' && !feedback && (
              <div className="mb-4">
                {(questaoAtual.alternativas ?? []).map((alt) => (
                  <div className="form-check mb-2" key={alt.letra}>
                    <input
                      className="form-check-input"
                      type="radio"
                      name="resposta"
                      id={`alt-${alt.letra}`}
                      value={alt.letra}
                      checked={resposta === alt.letra}
                      onChange={(e) => setResposta(e.target.value)}
                    />
                    <label className="form-check-label" htmlFor={`alt-${alt.letra}`}>
                      <strong>{alt.letra}.</strong> {alt.texto}
                    </label>
                  </div>
                ))}
              </div>
            )}

            {questaoAtual.tipo === 'redacao' && !feedback && (
              <div className="mb-4">
                {questaoAtual.limite_linhas_min && questaoAtual.limite_linhas_max && (
                  <p className="text-muted small">
                    Limite: {questaoAtual.limite_linhas_min} a {questaoAtual.limite_linhas_max} linhas
                  </p>
                )}
                <textarea
                  className="form-control"
                  rows={10}
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  placeholder="Escreva sua redação aqui..."
                />
                <div className="text-muted small mt-1">
                  {resposta.split('\n').length} linha(s) / {resposta.trim().split(/\s+/).filter(Boolean).length} palavras
                </div>
              </div>
            )}

            {feedback && (
              <div className={`alert ${feedback.correta === true ? 'alert-success' : feedback.correta === false ? 'alert-danger' : 'alert-info'} mb-3`}>
                <strong>{feedback.message}</strong>
                {feedback.explicacao && (
                  <p className="mb-0 mt-2 small">{feedback.explicacao}</p>
                )}
              </div>
            )}

            <div className="d-flex gap-2 flex-wrap">
              {!feedback ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={loading || !resposta.trim()}
                  >
                    {loading ? <><span className="spinner-border spinner-border-sm me-2" />Enviando...</> : 'Responder'}
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={avancar}
                    disabled={loading}
                  >
                    Pular
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={avancar}>
                  Próxima <i className="fas fa-arrow-right ms-1" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
