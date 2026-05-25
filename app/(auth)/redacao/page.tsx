'use client';

import { useState } from 'react';

type Tema = {
  titulo: string;
  enunciado: string;
  contexto: string;
  tres_aspectos: string[];
};

type Correcao = {
  nota_final: number;
  notas_criterios: {
    adequacao: number;
    coerencia: number;
    norma_culta: number;
    argumentacao: number;
  };
  pontos_fortes: string[];
  pontos_a_melhorar: string[];
  correcoes_especificas: Array<{ trecho: string; problema: string; sugestao: string }>;
  comentario_geral: string;
};

export default function RedacaoPage() {
  const [disciplina, setDisciplina] = useState('direito');
  const [tema, setTema] = useState<Tema | null>(null);
  const [texto, setTexto] = useState('');
  const [correcao, setCorrecao] = useState<Correcao | null>(null);
  const [loadingTema, setLoadingTema] = useState(false);
  const [loadingCorrigir, setLoadingCorrigir] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gerarTema = async () => {
    setError(null);
    setLoadingTema(true);
    setCorrecao(null);

    try {
      const response = await fetch(`/api/redacao/tema?disciplina=${encodeURIComponent(disciplina)}`);
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error || data.message || 'Falha ao gerar tema.');
        setTema(null);
      } else {
        setTema(data.tema);
      }
    } catch (err) {
      setError('Erro ao gerar tema. Tente novamente.');
      setTema(null);
    } finally {
      setLoadingTema(false);
    }
  };

  const enviarCorrecao = async () => {
    if (!tema) {
      setError('Gere um tema antes de enviar a redação.');
      return;
    }
    if (!texto.trim()) {
      setError('Escreva sua redação antes de enviar para correção.');
      return;
    }

    setError(null);
    setLoadingCorrigir(true);

    try {
      const response = await fetch('/api/redacao/corrigir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: tema.enunciado, aspectos: tema.tres_aspectos, texto })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error || 'Falha ao corrigir redação.');
        setCorrecao(null);
      } else {
        setCorrecao(data.resultado);
      }
    } catch (err) {
      setError('Erro ao enviar redação. Tente novamente.');
      setCorrecao(null);
    } finally {
      setLoadingCorrigir(false);
    }
  };

  return (
    <main className="container py-5">
      <div className="row gy-4">
        <div className="col-12">
          <h1>Redação</h1>
          <p className="text-muted">Gere um tema e envie sua redação para correção por IA.</p>
        </div>

        <div className="col-12">
          <div className="d-flex flex-column flex-md-row gap-3 mb-3 align-items-start">
            <div className="flex-fill">
              <label className="form-label">Disciplina / área</label>
              <input
                className="form-control"
                value={disciplina}
                onChange={(event) => setDisciplina(event.target.value)}
                placeholder="Exemplo: direito, educação, meio ambiente"
              />
            </div>
            <button className="btn btn-outline-primary align-self-end" onClick={gerarTema} disabled={loadingTema}>
              {loadingTema ? 'Gerando tema...' : 'Gerar novo tema'}
            </button>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {tema ? (
            <div className="card shadow-sm p-4 mb-4">
              <h2 className="h5">Tema gerado</h2>
              <p className="mb-1"><strong>Título:</strong> {tema.titulo}</p>
              <p className="mb-1"><strong>Enunciado:</strong> {tema.enunciado}</p>
              <p className="mb-1"><strong>Contexto:</strong> {tema.contexto}</p>
              <div>
                <strong>Aspectos a abordar:</strong>
                <ul className="mb-0">
                  {tema.tres_aspectos.map((aspecto, index) => (
                    <li key={index}>{aspecto}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="card shadow-sm p-4 mb-4">
              <h2 className="h5">Tema gerado</h2>
              <p className="text-muted">Clique em "Gerar novo tema" para receber um enunciado.</p>
            </div>
          )}

          <div className="card shadow-sm p-4 mb-4">
            <h2 className="h5">Escreva sua redação</h2>
            <textarea
              className="form-control mt-3"
              rows={12}
              placeholder="Escreva sua redação aqui..."
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
            />
            <div className="d-flex justify-content-between align-items-center mt-3">
              <small>{texto.trim().split(/\s+/).filter(Boolean).length} palavras</small>
              <button className="btn btn-primary" onClick={enviarCorrecao} disabled={loadingCorrigir || !tema || !texto.trim()}>
                {loadingCorrigir ? 'Enviando para correção...' : 'Enviar para correção'}
              </button>
            </div>
          </div>

          {correcao && (
            <div className="card shadow-sm p-4 mb-4">
              <h2 className="h5">Correção</h2>
              <p><strong>Nota final:</strong> {correcao.nota_final.toFixed(2)}</p>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <div className="border rounded p-3">
                    <strong>Notas por critério</strong>
                    <ul className="mb-0">
                      <li>Adequação: {correcao.notas_criterios.adequacao.toFixed(2)}</li>
                      <li>Coerência: {correcao.notas_criterios.coerencia.toFixed(2)}</li>
                      <li>Norma culta: {correcao.notas_criterios.norma_culta.toFixed(2)}</li>
                      <li>Argumentação: {correcao.notas_criterios.argumentacao.toFixed(2)}</li>
                    </ul>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded p-3">
                    <strong>Pontos fortes</strong>
                    <ul className="mb-0">
                      {correcao.pontos_fortes.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <strong>Pontos a melhorar</strong>
                <ul>
                  {correcao.pontos_a_melhorar.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="mb-3">
                <strong>Correções específicas</strong>
                <ul>
                  {correcao.correcoes_especificas.map((item, index) => (
                    <li key={index}>
                      <strong>{item.trecho}</strong>: {item.problema}. {item.sugestao}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Comentário geral</strong>
                <p>{correcao.comentario_geral}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
