'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Alternativa = { letra: string; texto: string };

type Questao = {
  id: string;
  tipo: 'verdadeiro_falso' | 'multipla_escolha' | 'redacao';
  enunciado: string;
  alternativas?: Alternativa[];
  disciplina?: string | null;
  assunto?: string | null;
  nivel?: string | null;
  limite_linhas_min?: number | null;
  limite_linhas_max?: number | null;
  criterios_avaliacao?: string[] | null;
  resposta_correta?: string | boolean | null;
  resposta_correta_boolean?: boolean | null;
};

type EnvioInfo = {
  id: string;
  usuario_id: string;
  status: string;
  criado_em: string;
};

type Estado = 'carregando' | 'erro' | 'respondendo' | 'concluido';

export default function ResponderPage() {
  const params = useParams();
  const token = params?.token as string;

  const [estado, setEstado] = useState<Estado>('carregando');
  const [erroMsg, setErroMsg] = useState('');
  const [envio, setEnvio] = useState<EnvioInfo | null>(null);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<string, { correta: boolean | null; message: string; explicacao?: string | null }>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/envios/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setErroMsg(data.error || 'Envio não encontrado.');
          setEstado('erro');
          return;
        }
        setEnvio(data.envio);
        setQuestoes(data.questoes);
        setEstado('respondendo');
      })
      .catch(() => {
        setErroMsg('Erro ao carregar as questões. Tente novamente.');
        setEstado('erro');
      });
  }, [token]);

  const questaoAtual = questoes[currentIndex] ?? null;

  const responderQuestao = async () => {
    if (!questaoAtual || !envio) return;
    const resposta = respostas[questaoAtual.id];
    if (!resposta?.trim()) return;

    setEnviando(true);
    try {
      const response = await fetch('/api/questoes/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: envio.usuario_id,
          questao_id: questaoAtual.id,
          resposta
        })
      });
      const data = await response.json();

      if (data.ok) {
        let message = '';
        if (questaoAtual.tipo === 'redacao') {
          message = 'Redação registrada com sucesso.';
        } else if (data.correta === true) {
          message = 'Resposta correta!';
        } else {
          message = 'Resposta incorreta.';
        }
        setFeedbacks((prev) => ({
          ...prev,
          [questaoAtual.id]: { correta: data.correta ?? null, message, explicacao: data.explicacao ?? null }
        }));
        setFeedback(message);
      }
    } catch {
      setFeedback('Erro ao enviar resposta.');
    } finally {
      setEnviando(false);
    }
  };

  const avancar = () => {
    setCurrentIndex((i) => i + 1);
    setFeedback(null);
  };

  const concluir = () => setEstado('concluido');

  if (estado === 'carregando') {
    return (
      <main className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
        <p className="mt-3 text-muted">Carregando suas questões...</p>
      </main>
    );
  }

  if (estado === 'erro') {
    return (
      <main className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card shadow-sm p-4 text-center">
              <i className="fas fa-exclamation-triangle fa-3x text-danger mb-3" />
              <h2 className="h4">Não foi possível carregar</h2>
              <p className="text-muted">{erroMsg}</p>
              <Link href="/login" className="btn btn-primary mt-2">Fazer login</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (estado === 'concluido') {
    const total = Object.keys(feedbacks).length;
    const acertos = Object.values(feedbacks).filter((f) => f.correta === true).length;
    const taxa = total > 0 ? Math.round((acertos / total) * 100) : 0;

    return (
      <main className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-7">
            <div className="card shadow-sm p-4 text-center">
              <i className="fas fa-check-circle fa-3x text-success mb-3" />
              <h2 className="h4">Sessão concluída!</h2>
              <p className="text-muted">Você respondeu {total} questão(ões).</p>
              <div className="row g-3 mt-2 mb-3">
                <div className="col-4">
                  <div className="border rounded p-2">
                    <div className="text-success fw-bold fs-4">{acertos}</div>
                    <div className="text-muted small">Acertos</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="border rounded p-2">
                    <div className="text-danger fw-bold fs-4">{total - acertos}</div>
                    <div className="text-muted small">Erros</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="border rounded p-2">
                    <div className="text-primary fw-bold fs-4">{taxa}%</div>
                    <div className="text-muted small">Taxa</div>
                  </div>
                </div>
              </div>
              <Link href="/login" className="btn btn-outline-primary">Acessar minha conta</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!questaoAtual) {
    return (
      <main className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-7">
            <div className="card shadow-sm p-4 text-center">
              <h2 className="h4">Todas as questões respondidas!</h2>
              <button className="btn btn-success mt-3" onClick={concluir}>Ver resultado</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const jaRespondida = Boolean(feedbacks[questaoAtual.id]);

  return (
    <main className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="h4 mb-0">
              <i className="fas fa-graduation-cap me-2 text-primary" />
              Questões enviadas
            </h1>
            <span className="badge bg-secondary">{currentIndex + 1} / {questoes.length}</span>
          </div>

          <div className="card shadow-sm">
            <div className="card-header">
              <span className="badge bg-info text-dark me-2">{questaoAtual.tipo.replace('_', ' ')}</span>
              {questaoAtual.disciplina && <small className="text-muted">{questaoAtual.disciplina}</small>}
            </div>
            <div className="card-body">
              <p className="fs-5 mb-4">{questaoAtual.enunciado}</p>

              {questaoAtual.tipo === 'verdadeiro_falso' && !jaRespondida && (
                <div className="d-flex gap-3 mb-4">
                  {['true', 'false'].map((val) => (
                    <div className="form-check" key={val}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="resposta"
                        id={`vf-${val}`}
                        value={val}
                        checked={respostas[questaoAtual.id] === val}
                        onChange={() => setRespostas((p) => ({ ...p, [questaoAtual.id]: val }))}
                      />
                      <label className="form-check-label" htmlFor={`vf-${val}`}>
                        {val === 'true' ? 'Verdadeiro' : 'Falso'}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {questaoAtual.tipo === 'multipla_escolha' && !jaRespondida && (
                <div className="mb-4">
                  {(questaoAtual.alternativas ?? []).map((alt) => (
                    <div className="form-check mb-2" key={alt.letra}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="resposta"
                        id={`alt-${alt.letra}`}
                        value={alt.letra}
                        checked={respostas[questaoAtual.id] === alt.letra}
                        onChange={() => setRespostas((p) => ({ ...p, [questaoAtual.id]: alt.letra }))}
                      />
                      <label className="form-check-label" htmlFor={`alt-${alt.letra}`}>
                        <strong>{alt.letra}.</strong> {alt.texto}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {questaoAtual.tipo === 'redacao' && !jaRespondida && (
                <div className="mb-4">
                  {questaoAtual.limite_linhas_min && questaoAtual.limite_linhas_max && (
                    <p className="text-muted small">Limite: {questaoAtual.limite_linhas_min}–{questaoAtual.limite_linhas_max} linhas</p>
                  )}
                  <textarea
                    className="form-control"
                    rows={10}
                    value={respostas[questaoAtual.id] ?? ''}
                    onChange={(e) => setRespostas((p) => ({ ...p, [questaoAtual.id]: e.target.value }))}
                    placeholder="Escreva sua redação aqui..."
                  />
                </div>
              )}

              {feedback && (() => {
                const fb = feedbacks[questaoAtual.id];
                const isCorrect = fb?.correta === true;
                const isWrong = fb?.correta === false;
                return (
                  <div className={`alert ${isCorrect ? 'alert-success' : isWrong ? 'alert-danger' : 'alert-info'} mb-3`}>
                    <strong>{feedback}</strong>
                    {fb?.explicacao && (
                      <p className="mb-0 mt-1 small">
                        <i className="fas fa-lightbulb me-1" />
                        {fb.explicacao}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="d-flex gap-2">
                {!jaRespondida ? (
                  <button
                    className="btn btn-primary"
                    onClick={responderQuestao}
                    disabled={enviando || !respostas[questaoAtual.id]?.trim()}
                  >
                    {enviando ? <><span className="spinner-border spinner-border-sm me-2" />Enviando...</> : 'Responder'}
                  </button>
                ) : (
                  currentIndex < questoes.length - 1 ? (
                    <button className="btn btn-primary" onClick={avancar}>
                      Próxima <i className="fas fa-arrow-right ms-1" />
                    </button>
                  ) : (
                    <button className="btn btn-success" onClick={concluir}>
                      Ver resultado <i className="fas fa-trophy ms-1" />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-center gap-2 mt-3">
            {questoes.map((_, i) => (
              <span
                key={i}
                className={`badge ${i === currentIndex ? 'bg-primary' : feedbacks[questoes[i].id] !== undefined ? 'bg-success' : 'bg-secondary'}`}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
