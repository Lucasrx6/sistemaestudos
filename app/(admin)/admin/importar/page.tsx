'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ImportResult = {
  inseridas: number;
  erros: Array<{ indice: number; motivo: string; questao: unknown }>;
  concursosCriados?: string[];
};

type ErroValidacao = {
  indice: number;
  enunciado: string;
  motivo: string;
};

type DiagnosticoParsed = {
  total: number;
  validas: number;
  invalidas: number;
  porTipo: { verdadeiro_falso: number; multipla_escolha: number; redacao: number };
  concursos: Record<string, number>;
  erros: ErroValidacao[];
};

// ─── Validação client-side (JS puro, sem Zod) ─────────────────────────────────

function validarQuestao(q: unknown, indice: number): string | null {
  if (!q || typeof q !== 'object') return 'Item não é um objeto válido.';
  const questao = q as Record<string, unknown>;

  const enunciado = questao.enunciado;
  if (!enunciado || typeof enunciado !== 'string' || enunciado.trim() === '') {
    return 'Enunciado é obrigatório e deve ser texto não vazio.';
  }

  const tipo = questao.tipo;
  if (!tipo || typeof tipo !== 'string') {
    return 'Campo "tipo" é obrigatório.';
  }
  if (!['verdadeiro_falso', 'multipla_escolha', 'redacao'].includes(tipo)) {
    return `Tipo inválido: "${tipo}". Deve ser verdadeiro_falso, multipla_escolha ou redacao.`;
  }

  if (tipo === 'verdadeiro_falso') {
    if (typeof questao.resposta_correta !== 'boolean' && questao.resposta_correta !== true && questao.resposta_correta !== false) {
      return 'Para verdadeiro_falso, resposta_correta deve ser boolean (true ou false).';
    }
  }

  if (tipo === 'multipla_escolha') {
    const rc = questao.resposta_correta;
    if (!rc || typeof rc !== 'string' || rc.trim() === '') {
      return 'Para multipla_escolha, resposta_correta deve ser uma string com a letra correta.';
    }
    const alts = questao.alternativas;
    if (!Array.isArray(alts) || alts.length < 2) {
      return 'Para multipla_escolha, alternativas deve ter ao menos 2 itens.';
    }
    for (let i = 0; i < alts.length; i++) {
      const alt = alts[i] as Record<string, unknown>;
      if (!alt.letra || typeof alt.letra !== 'string') {
        return `Alternativa ${i + 1}: campo "letra" ausente ou inválido.`;
      }
      if (!alt.texto || typeof alt.texto !== 'string') {
        return `Alternativa ${i + 1}: campo "texto" ausente ou inválido.`;
      }
    }
  }

  if (tipo === 'redacao') {
    const criterios = questao.criterios_avaliacao;
    if (!Array.isArray(criterios) || criterios.length === 0) {
      return 'Para redacao, criterios_avaliacao deve ser um array não vazio.';
    }
  }

  return null;
}

function gerarDiagnostico(questoes: unknown[]): DiagnosticoParsed {
  const erros: ErroValidacao[] = [];
  const porTipo = { verdadeiro_falso: 0, multipla_escolha: 0, redacao: 0 };
  const concursos: Record<string, number> = {};
  let validas = 0;

  questoes.forEach((q, i) => {
    const motivo = validarQuestao(q, i);
    const questaoObj = (q && typeof q === 'object') ? q as Record<string, unknown> : {};
    const enunciado = typeof questaoObj.enunciado === 'string'
      ? questaoObj.enunciado.slice(0, 60)
      : '(enunciado ausente)';

    if (motivo) {
      erros.push({ indice: i, enunciado, motivo });
    } else {
      validas++;
      const tipo = questaoObj.tipo as string;
      if (tipo === 'verdadeiro_falso') porTipo.verdadeiro_falso++;
      else if (tipo === 'multipla_escolha') porTipo.multipla_escolha++;
      else if (tipo === 'redacao') porTipo.redacao++;

      if (Array.isArray(questaoObj.concursos)) {
        (questaoObj.concursos as string[]).forEach((slug) => {
          concursos[slug] = (concursos[slug] ?? 0) + 1;
        });
      }
    }
  });

  return {
    total: questoes.length,
    validas,
    invalidas: erros.length,
    porTipo,
    concursos,
    erros
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AdminImportarPage() {
  const [jsonContent, setJsonContent] = useState('');
  const [parsedQuestoes, setParsedQuestoes] = useState<unknown[]>([]);
  const [parsedPayload, setParsedPayload] = useState<unknown>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pularInvalidas, setPularInvalidas] = useState(false);
  const [errosExpandidos, setErrosExpandidos] = useState(false);

  // Diagnóstico calculado automaticamente sempre que as questões mudam
  const diagnostico = useMemo<DiagnosticoParsed | null>(
    () => (parsedQuestoes.length > 0 ? gerarDiagnostico(parsedQuestoes) : null),
    [parsedQuestoes]
  );

  const processarJson = useCallback((text: string) => {
    setParseError(null);
    setResult(null);
    setParsedQuestoes([]);
    setParsedPayload(null);

    if (!text.trim()) return;

    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.questoes)) {
        setParseError('O JSON deve conter um campo "questoes" com um array.');
        return;
      }
      setParsedQuestoes(parsed.questoes);
      setParsedPayload(parsed);
    } catch {
      setParseError('JSON inválido. Verifique a sintaxe do arquivo.');
    }
  }, []);

  // Reprocessar diagnóstico sempre que o conteúdo mudar
  useEffect(() => {
    processarJson(jsonContent);
  }, [jsonContent, processarJson]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setJsonContent('');
      return;
    }
    const text = await file.text();
    setJsonContent(text);
  };

  const handleImport = async (apenasValidas: boolean) => {
    if (!parsedPayload) return;
    setLoading(true);
    setResult(null);
    setParseError(null);

    try {
      let payload = parsedPayload as Record<string, unknown>;

      if (apenasValidas && diagnostico && diagnostico.invalidas > 0) {
        // Filtra somente as questões válidas antes de enviar
        const questoesValidas = parsedQuestoes.filter((_, i) => validarQuestao(_, i) === null);
        payload = { ...payload, questoes: questoesValidas };
      }

      const response = await fetch('/api/admin/questoes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        let errorMessage = 'Falha na importação.';
        if (data.error) {
          if (typeof data.error === 'string') {
            errorMessage = data.error;
          } else if (data.error.message) {
            errorMessage = data.error.message;
          } else if (data.error.fieldErrors || data.error.formErrors) {
            errorMessage = 'Erro de validação na API (Zod): ' + JSON.stringify(data.error);
          } else {
            errorMessage = JSON.stringify(data.error);
          }
        }
        setParseError(errorMessage);
      } else {
        setResult(data);
      }
    } catch {
      setParseError('Erro ao enviar importação. Verifique o JSON.');
    } finally {
      setLoading(false);
    }
  };

  const hasContent = jsonContent.trim().length > 0;
  const temErros = diagnostico ? diagnostico.invalidas > 0 : false;
  const percentualValidas = diagnostico && diagnostico.total > 0
    ? Math.round((diagnostico.validas / diagnostico.total) * 100)
    : 0;

  return (
    <main className="container py-5">
      <h1>Importar questões</h1>
      <p className="text-muted">Faça upload de JSON em massa — o diagnóstico aparece automaticamente.</p>

      {/* ── Área de entrada ─────────────────────────────────────────────────── */}
      <div className="card shadow-sm p-4 mb-4">
        <div className="mb-3">
          <label className="form-label">Arquivo JSON</label>
          <input
            type="file"
            className="form-control"
            accept="application/json"
            onChange={handleFile}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Conteúdo JSON</label>
          <textarea
            className="form-control font-monospace"
            rows={8}
            value={jsonContent}
            onChange={(e) => setJsonContent(e.target.value)}
            placeholder="Cole o JSON ou selecione um arquivo..."
          />
        </div>
        {parseError && <div className="alert alert-danger">{parseError}</div>}
      </div>

      {/* ── Painel de Diagnóstico (Melhoria 1) ──────────────────────────────── */}
      {diagnostico && (
        <div className={`card shadow-sm mb-4 border-${temErros ? 'warning' : 'success'}`}>
          <div className={`card-header bg-${temErros ? 'warning' : 'success'} bg-opacity-10`}>
            <div className="d-flex justify-content-between align-items-center">
              <strong>
                <i className={`fas fa-${temErros ? 'exclamation-triangle text-warning' : 'check-circle text-success'} me-2`} />
                Diagnóstico — {diagnostico.total} questão(ões) carregada(s)
              </strong>
              <span className="badge bg-secondary">{percentualValidas}% válidas</span>
            </div>
          </div>
          <div className="card-body">

            {/* Barra de progresso */}
            <div className="mb-3">
              <div className="d-flex justify-content-between small mb-1">
                <span className="text-success">
                  <i className="fas fa-check-circle me-1" />{diagnostico.validas} válida(s)
                </span>
                <span className="text-danger">
                  <i className="fas fa-times-circle me-1" />{diagnostico.invalidas} com erro
                </span>
              </div>
              <div className="progress" style={{ height: '10px' }}>
                <div
                  className="progress-bar bg-success"
                  style={{ width: `${percentualValidas}%`, transition: 'width 0.4s ease' }}
                />
                <div
                  className="progress-bar bg-danger"
                  style={{ width: `${100 - percentualValidas}%` }}
                />
              </div>
            </div>

            {/* Tipos e concursos */}
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <div className="border rounded p-2 h-100">
                  <small className="text-muted d-block mb-1"><strong>Tipos de questão</strong></small>
                  <div className="d-flex flex-wrap gap-2">
                    {diagnostico.porTipo.verdadeiro_falso > 0 && (
                      <span className="badge bg-primary">{diagnostico.porTipo.verdadeiro_falso} V/F</span>
                    )}
                    {diagnostico.porTipo.multipla_escolha > 0 && (
                      <span className="badge bg-info text-dark">{diagnostico.porTipo.multipla_escolha} MC</span>
                    )}
                    {diagnostico.porTipo.redacao > 0 && (
                      <span className="badge bg-secondary">{diagnostico.porTipo.redacao} Redação</span>
                    )}
                    {diagnostico.validas === 0 && (
                      <span className="text-muted small">Nenhuma válida ainda</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="border rounded p-2 h-100">
                  <small className="text-muted d-block mb-1"><strong>Concursos referenciados</strong></small>
                  {Object.keys(diagnostico.concursos).length === 0 ? (
                    <span className="text-muted small">Nenhum concurso identificado</span>
                  ) : (
                    <div className="d-flex flex-wrap gap-1">
                      {Object.entries(diagnostico.concursos).map(([slug, count]) => (
                        <span key={slug} className="badge bg-light text-dark border">
                          {slug} ({count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de erros */}
            {diagnostico.invalidas > 0 && (
              <div className="mb-3">
                <button
                  className="btn btn-sm btn-outline-danger mb-2"
                  onClick={() => setErrosExpandidos((v) => !v)}
                  type="button"
                >
                  <i className={`fas fa-chevron-${errosExpandidos ? 'up' : 'down'} me-1`} />
                  {errosExpandidos ? 'Ocultar' : 'Ver'} {diagnostico.invalidas} erro(s) encontrado(s)
                </button>

                {errosExpandidos && (
                  <div className="border border-danger rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {diagnostico.erros.map((e) => (
                      <div key={e.indice} className="mb-2 pb-2 border-bottom last-child-no-border">
                        <div className="d-flex align-items-start gap-2">
                          <span className="badge bg-danger flex-shrink-0">Q#{e.indice + 1}</span>
                          <div>
                            <div className="small text-muted fst-italic">
                              &ldquo;{e.enunciado}{e.enunciado.length >= 60 ? '…' : ''}&rdquo;
                            </div>
                            <div className="small text-danger mt-1">
                              <i className="fas fa-arrow-right me-1" />{e.motivo}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Botões de importação condicionais */}
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {temErros ? (
                <>
                  <div className="form-check mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="pular-invalidas"
                      checked={pularInvalidas}
                      onChange={(e) => setPularInvalidas(e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="pular-invalidas">
                      Pular questões com erro e importar apenas as válidas
                    </label>
                  </div>
                  <button
                    className={`btn ${pularInvalidas ? 'btn-warning' : 'btn-outline-secondary'}`}
                    onClick={() => handleImport(true)}
                    disabled={loading || diagnostico.validas === 0}
                    type="button"
                  >
                    {loading
                      ? <><span className="spinner-border spinner-border-sm me-2" />Importando...</>
                      : <><i className="fas fa-filter me-2" />Importar válidas ({diagnostico.validas})</>
                    }
                  </button>
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => handleImport(false)}
                    disabled={loading}
                    type="button"
                  >
                    {loading
                      ? <><span className="spinner-border spinner-border-sm me-2" />Importando...</>
                      : <><i className="fas fa-upload me-2" />Importar todas ({diagnostico.total})</>
                    }
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => handleImport(false)}
                  disabled={loading || diagnostico.validas === 0}
                  type="button"
                >
                  {loading
                    ? <><span className="spinner-border spinner-border-sm me-2" />Importando...</>
                    : <><i className="fas fa-upload me-2" />Importar todas ({diagnostico.total})</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Resultado da importação (Melhoria 1 — melhorado) ────────────────── */}
      {result && (
        <div className="card shadow-sm">
          <div className={`card-header ${result.erros.length === 0 ? 'bg-success bg-opacity-10' : 'bg-warning bg-opacity-10'}`}>
            <strong>
              <i className={`fas fa-${result.erros.length === 0 ? 'check-circle text-success' : 'exclamation-triangle text-warning'} me-2`} />
              Resultado da importação
            </strong>
          </div>
          <div className="card-body">
            <p className="mb-2">
              <i className="fas fa-database me-2 text-success" />
              <strong>{result.inseridas}</strong> questão(ões) inserida(s) com sucesso.
            </p>

            {result.concursosCriados && result.concursosCriados.length > 0 && (
              <div className="mb-3">
                <strong>Concursos criados automaticamente:</strong>
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {result.concursosCriados.map((slug) => (
                    <span key={slug} className="badge bg-success">{slug}</span>
                  ))}
                </div>
              </div>
            )}

            {result.erros.length > 0 ? (
              <div>
                <p className="text-danger mb-2">
                  <i className="fas fa-times-circle me-1" />
                  {result.erros.length} questão(ões) com erro na importação:
                </p>
                <ul className="list-unstyled mb-0">
                  {result.erros.map((erro) => {
                    const questaoErro = (erro.questao && typeof erro.questao === 'object')
                      ? erro.questao as Record<string, unknown>
                      : {};
                    const enunciado = typeof questaoErro.enunciado === 'string'
                      ? questaoErro.enunciado.slice(0, 60)
                      : null;
                    return (
                      <li key={erro.indice} className="mb-2 d-flex gap-2 align-items-start">
                        <span className="badge bg-danger flex-shrink-0">Q#{erro.indice + 1}</span>
                        <div>
                          {enunciado && (
                            <div className="small text-muted fst-italic">&ldquo;{enunciado}…&rdquo;</div>
                          )}
                          <div className="small">{erro.motivo}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="alert alert-success mb-0">
                <i className="fas fa-check-circle me-2" />Importação concluída sem erros.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
