'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

const nivelBadge: Record<string, string> = {
  basico: 'bg-success',
  intermediario: 'bg-warning text-dark',
  avancado: 'bg-danger'
};

const tipoBadge: Record<string, { label: string; icon: string; cls: string }> = {
  verdadeiro_falso: { label: 'Verdadeiro/Falso', icon: 'fa-check-double', cls: 'bg-primary' },
  multipla_escolha: { label: 'Múltipla Escolha', icon: 'fa-list-ul', cls: 'bg-info' },
  redacao: { label: 'Redação', icon: 'fa-pen-nib', cls: 'bg-secondary' }
};

export default function EstudarPage() {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resposta, setResposta] = useState('');
  const [loading, setLoading] = useState(true); // true desde o início evita flash de "sem questões"
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [session, setSession] = useState<{ userId: string; token: string } | null>(null);
  const [sessionado, setSessionado] = useState(false);
  const [cardAnim, setCardAnim] = useState<'' | 'acertou' | 'errou'>('');
  const initialFetchDone = useRef(false); // evita double-fetch do StrictMode

  const questaoAtual = useMemo(() => questoes[currentIndex] ?? null, [questoes, currentIndex]);
  const progresso = useMemo(
    () => (questoes.length > 0 ? (currentIndex / questoes.length) * 100 : 0),
    [currentIndex, questoes.length]
  );

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
    setCardAnim('');
    try {
      const response = await fetch(`/api/questoes/proximas`, {
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
    if (!session) return;
    if (initialFetchDone.current) return; // StrictMode dispara o effect duas vezes — ignora a segunda
    initialFetchDone.current = true;
    fetchQuestoes(session.token);
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
          resposta
        })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error || 'Não foi possível enviar sua resposta.');
        return;
      }

      let message = '';
      if (questaoAtual.tipo === 'redacao') {
        message = 'Redação registrada! Acesse a seção Redação para ver a correção por IA.';
      } else if (data.correta) {
        message = 'Resposta correta! Continue assim! 🎯';
      } else {
        message = 'Resposta incorreta. Não desanime, revise e tente novamente!';
      }

      // Animação no card
      if (questaoAtual.tipo !== 'redacao') {
        const anim = data.correta ? 'acertou' : 'errou';
        setCardAnim(anim);
        setTimeout(() => setCardAnim(''), 800);
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
    setCardAnim('');
  };

  if (!sessionado) {
    return (
      <main className="container py-5">
        <div className="loading-screen">
          <div className="spinner-border" role="status" />
          <span>Carregando sua sessão...</span>
        </div>
      </main>
    );
  }

  const tipoInfo = questaoAtual ? (tipoBadge[questaoAtual.tipo] ?? tipoBadge.redacao) : null;

  return (
    <main className="container py-4">
      {/* Cabeçalho */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h1 className="h3 mb-0 fw-700">
            <i className="fas fa-graduation-cap me-2 text-purple" />
            Estudar
          </h1>
          <p className="text-muted mb-0 small">Questões inteligentes selecionadas pelo seu histórico.</p>
        </div>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => session && fetchQuestoes(session.token)}
          disabled={loading}
        >
          <i className="fas fa-sync-alt me-1" /> Nova rodada
        </button>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
          <i className="fas fa-exclamation-circle fa-lg" />
          {error}
        </div>
      )}

      {loading && !questaoAtual ? (
        <div className="loading-screen">
          <div className="spinner-border" role="status" />
          <span>Carregando questões personalizadas...</span>
        </div>
      ) : currentIndex >= questoes.length && questoes.length > 0 ? (

        /* ── Rodada concluída ── */
        <div className="card text-center py-5 px-4">
          <i className={`fas fa-trophy fa-4x text-warning mb-3 trophy-anim`} />
          <h2 className="h3 fw-700 mb-1">Rodada concluída!</h2>
          <p className="text-muted mb-1">Você respondeu <strong>{questoes.length}</strong> questões nesta sessão.</p>
          <div className="d-flex justify-content-center gap-2 mt-4 flex-wrap">
            <button className="btn btn-primary px-4" onClick={() => session && fetchQuestoes(session.token)}>
              <i className="fas fa-redo me-2" />Nova rodada
            </button>
            <a className="btn btn-outline-secondary px-4" href="/dashboard">
              <i className="fas fa-chart-bar me-2" />Ver estatísticas
            </a>
          </div>
        </div>

      ) : !questaoAtual ? (

        /* ── Sem questões ── */
        <div className="card text-center py-5 px-4">
          <i className="fas fa-inbox fa-3x text-muted mb-3" />
          <h2 className="h5 fw-700 mb-1">Nenhuma questão disponível</h2>
          <p className="text-muted small mb-4">Verifique se você configurou as provas ativas nas <a href="/configuracoes">Configurações</a>.</p>
          <button className="btn btn-primary" onClick={() => session && fetchQuestoes(session.token)}>
            <i className="fas fa-sync-alt me-2" />Tentar novamente
          </button>
        </div>

      ) : (
        <>
          {/* Barra de progresso */}
          <div className="d-flex align-items-center gap-2 mb-3">
            <div className="progress flex-grow-1" style={{ height: '8px' }}>
              <div
                className="progress-bar bg-primary"
                style={{ width: `${progresso}%`, transition: 'width 0.4s ease' }}
              />
            </div>
            <span className="text-muted small fw-700" style={{ minWidth: '60px' }}>
              {currentIndex + 1} / {questoes.length}
            </span>
          </div>

          {/* Card da questão */}
          <div className={`questao-card card ${cardAnim}`}>
            {/* Header */}
            <div className="card-header px-4 py-3 d-flex align-items-center gap-2 flex-wrap">
              {tipoInfo && (
                <span className={`badge ${tipoInfo.cls} d-flex align-items-center gap-1`}>
                  <i className={`fas ${tipoInfo.icon}`} /> {tipoInfo.label}
                </span>
              )}
              {questaoAtual.disciplina && (
                <span className="badge bg-light text-dark border d-flex align-items-center gap-1">
                  <i className="fas fa-book-open" /> {questaoAtual.disciplina}
                  {questaoAtual.assunto && <span className="text-muted ms-1">· {questaoAtual.assunto}</span>}
                </span>
              )}
              {questaoAtual.nivel && (
                <span className={`badge ${nivelBadge[questaoAtual.nivel] ?? 'bg-secondary'} ms-auto`}>
                  {questaoAtual.nivel}
                </span>
              )}
            </div>

            <div className="card-body px-4 py-4">
              {/* Enunciado */}
              <p className="fs-5 mb-4 lh-base" style={{ fontWeight: 500 }}>
                {questaoAtual.enunciado}
              </p>

              {/* ── Verdadeiro / Falso ── */}
              {questaoAtual.tipo === 'verdadeiro_falso' && !feedback && (
                <div className="d-flex gap-3 mb-4">
                  {[
                    { val: 'true',  label: 'Verdadeiro', icon: 'fa-check',     cls: 'vf-true' },
                    { val: 'false', label: 'Falso',      icon: 'fa-times',     cls: 'vf-false' }
                  ].map(({ val, label, icon, cls }) => (
                    <button
                      key={val}
                      className={`vf-btn ${cls} ${resposta === val ? 'selected' : ''}`}
                      onClick={() => setResposta(val)}
                    >
                      <i className={`fas ${icon}`} /> {label}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Múltipla escolha ── */}
              {questaoAtual.tipo === 'multipla_escolha' && !feedback && (
                <div className="mb-4">
                  {(questaoAtual.alternativas ?? []).map((alt) => (
                    <button
                      key={alt.letra}
                      className={`alternativa-btn ${resposta === alt.letra ? 'selected' : ''}`}
                      onClick={() => setResposta(alt.letra)}
                    >
                      <span className="fw-700 me-2">{alt.letra}.</span> {alt.texto}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Redação ── */}
              {questaoAtual.tipo === 'redacao' && !feedback && (
                <div className="mb-4">
                  {questaoAtual.criterios_avaliacao && questaoAtual.criterios_avaliacao.length > 0 && (
                    <div className="mb-3 p-3 rounded-3" style={{ background: '#f8f9fa', borderLeft: '4px solid var(--primary)' }}>
                      <p className="small fw-700 mb-1 text-purple">
                        <i className="fas fa-clipboard-list me-1" /> Critérios de avaliação
                      </p>
                      <ul className="mb-0 ps-3 small text-muted">
                        {questaoAtual.criterios_avaliacao.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                  {(questaoAtual.limite_linhas_min || questaoAtual.limite_linhas_max) && (
                    <p className="text-muted small mb-2">
                      <i className="fas fa-ruler me-1" />
                      Limite: {questaoAtual.limite_linhas_min ?? '?'} a {questaoAtual.limite_linhas_max ?? '?'} linhas
                    </p>
                  )}
                  <textarea
                    className="form-control"
                    rows={10}
                    value={resposta}
                    onChange={(e) => setResposta(e.target.value)}
                    placeholder="Escreva sua redação aqui..."
                    style={{ fontSize: '0.95rem' }}
                  />
                  <div className="text-muted small mt-1 d-flex gap-3">
                    <span><i className="fas fa-list-ol me-1" />{resposta.split('\n').length} linha(s)</span>
                    <span><i className="fas fa-font me-1" />{resposta.trim().split(/\s+/).filter(Boolean).length} palavras</span>
                  </div>
                </div>
              )}

              {/* ── Alternativas após feedback ── */}
              {feedback && questaoAtual.tipo === 'multipla_escolha' && (
                <div className="mb-4">
                  {(questaoAtual.alternativas ?? []).map((alt) => {
                    const respostaCorreta = questaoAtual.alternativas?.find(a =>
                      feedback.correta === false && a.letra !== resposta
                    );
                    let cls = '';
                    if (feedback.correta && alt.letra === resposta) cls = 'correta';
                    if (!feedback.correta && alt.letra === resposta) cls = 'errada';
                    return (
                      <div
                        key={alt.letra}
                        className={`alternativa-btn ${cls}`}
                        style={{ cursor: 'default', pointerEvents: 'none' }}
                      >
                        <span className="fw-700 me-2">{alt.letra}.</span> {alt.texto}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Feedback box ── */}
              {feedback && (
                <div className={`feedback-box mb-4 ${feedback.correta === true ? 'correct' : feedback.correta === false ? 'incorrect' : 'neutral'}`}>
                  <span className="feedback-icon">
                    {feedback.correta === true  ? '🎯' : feedback.correta === false ? '❌' : '📝'}
                  </span>
                  <div>
                    <strong className="d-block mb-1">{feedback.message}</strong>
                    {feedback.explicacao && (
                      <p className="mb-0 small" style={{ opacity: 0.85 }}>
                        <i className="fas fa-lightbulb me-1" />{feedback.explicacao}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Botões de ação ── */}
              <div className="d-flex gap-2 flex-wrap">
                {!feedback ? (
                  <>
                    <button
                      className="btn btn-primary px-4"
                      onClick={handleSubmit}
                      disabled={loading || !resposta.trim()}
                    >
                      {loading
                        ? <><span className="spinner-border spinner-border-sm me-2" />Enviando...</>
                        : <><i className="fas fa-paper-plane me-2" />Responder</>}
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      onClick={avancar}
                      disabled={loading}
                    >
                      <i className="fas fa-forward me-1" /> Pular
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary px-4" onClick={avancar}>
                    <i className="fas fa-arrow-right me-2" />Próxima questão
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
