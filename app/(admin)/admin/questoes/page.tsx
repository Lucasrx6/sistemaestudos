'use client';

import { useEffect, useMemo, useState } from 'react';

type QuestaoAdmin = {
  id: string;
  tipo: string;
  enunciado: string;
  disciplina: string | null;
  assunto: string | null;
  nivel: string | null;
  ativo: boolean;
  concursos: string[];
};

type FormState = {
  id?: string;
  tipo: 'verdadeiro_falso' | 'multipla_escolha' | 'redacao';
  enunciado: string;
  explicacao: string;
  disciplina: string;
  assunto: string;
  nivel: 'basico' | 'intermediario' | 'avancado';
  ativo: boolean;
  resposta_correta: string;
  resposta_correta_boolean: boolean;
  alternativas: { letra: string; texto: string }[];
  limite_linhas_min: number;
  limite_linhas_max: number;
  criterios_avaliacao: string;
  concursos: string;
  fonte: string;
  tags: string;
};

const initialFormState: FormState = {
  tipo: 'verdadeiro_falso',
  enunciado: '',
  explicacao: '',
  disciplina: '',
  assunto: '',
  nivel: 'basico',
  ativo: true,
  resposta_correta: 'A',
  resposta_correta_boolean: true,
  alternativas: [
    { letra: 'A', texto: '' },
    { letra: 'B', texto: '' }
  ],
  limite_linhas_min: 20,
  limite_linhas_max: 30,
  criterios_avaliacao: '',
  concursos: '',
  fonte: '',
  tags: ''
};

const createDefaultAlternativas = () => [
  { letra: 'A', texto: '' },
  { letra: 'B', texto: '' }
];

export default function AdminQuestoesPage() {
  const [questoes, setQuestoes] = useState<QuestaoAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchQuestoes = async () => {
    setLoading(true);
    const response = await fetch('/api/admin/questoes');
    const data = await response.json();
    setQuestoes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestoes();
  }, []);

  const abrirModal = async (questao?: QuestaoAdmin) => {
    if (!questao) {
      setFormState(initialFormState);
      setModalOpen(true);
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/admin/questoes?id=${questao.id}`);
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error?.message || 'Erro ao carregar questão.');
      return;
    }

    setFormState({
      id: data.id,
      tipo: data.tipo as FormState['tipo'],
      enunciado: data.enunciado,
      explicacao: data.explicacao ?? '',
      disciplina: data.disciplina ?? '',
      assunto: data.assunto ?? '',
      nivel: (data.nivel as FormState['nivel']) ?? 'basico',
      ativo: data.ativo,
      resposta_correta: typeof data.resposta_correta === 'string' ? data.resposta_correta : 'A',
      resposta_correta_boolean: data.resposta_correta_boolean ?? true,
      alternativas: Array.isArray(data.alternativas) && data.alternativas.length > 0
        ? data.alternativas
        : createDefaultAlternativas(),
      limite_linhas_min: data.limite_linhas_min ?? 20,
      limite_linhas_max: data.limite_linhas_max ?? 30,
      criterios_avaliacao: Array.isArray(data.criterios_avaliacao)
        ? data.criterios_avaliacao.join(', ')
        : '',
      concursos: Array.isArray(data.concursos) ? data.concursos.join(', ') : '',
      fonte: data.fonte ?? '',
      tags: Array.isArray(data.tags) ? data.tags.join(', ') : ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    const body = {
      ...formState,
      concursos: formState.concursos.split(',').map((slug) => slug.trim()).filter(Boolean),
      tags: formState.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      criterios_avaliacao: formState.tipo === 'redacao'
        ? formState.criterios_avaliacao.split(',').map((crit) => crit.trim()).filter(Boolean)
        : undefined,
      alternativas: formState.tipo === 'multipla_escolha'
        ? formState.alternativas.filter((alt) => alt.texto.trim())
        : undefined,
      resposta_correta: formState.tipo === 'verdadeiro_falso'
        ? formState.resposta_correta_boolean
        : formState.tipo === 'multipla_escolha'
          ? formState.resposta_correta
          : null
    };

    const method = formState.id ? 'PATCH' : 'POST';
    const response = await fetch('/api/admin/questoes', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error?.message || 'Erro ao salvar questão.');
      return;
    }

    setSuccess('Questão salva com sucesso.');
    setModalOpen(false);
    fetchQuestoes();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja excluir esta questão?')) return;
    await fetch(`/api/admin/questoes?id=${id}`, { method: 'DELETE' });
    fetchQuestoes();
  };

  const handleTipoChange = (tipo: FormState['tipo']) => {
    setFormState((prev) => ({
      ...prev,
      tipo,
      resposta_correta: tipo === 'multipla_escolha' ? 'A' : prev.resposta_correta,
      resposta_correta_boolean: tipo === 'verdadeiro_falso' ? true : prev.resposta_correta_boolean,
      alternativas: tipo === 'multipla_escolha' ? (prev.alternativas.length ? prev.alternativas : createDefaultAlternativas()) : createDefaultAlternativas(),
      limite_linhas_min: tipo === 'redacao' ? prev.limite_linhas_min || 20 : 20,
      limite_linhas_max: tipo === 'redacao' ? prev.limite_linhas_max || 30 : 30,
      criterios_avaliacao: tipo === 'redacao' ? prev.criterios_avaliacao : ''
    }));
  };

  const handleAlternativaChange = (index: number, texto: string) => {
    const alternativas = formState.alternativas.map((item, idx) =>
      idx === index ? { ...item, texto } : item
    );
    setFormState((prev) => ({ ...prev, alternativas }));
  };

  const handleAddAlternativa = () => {
    setFormState((prev) => {
      const nextLetter = String.fromCharCode(65 + prev.alternativas.length);
      return {
        ...prev,
        alternativas: [...prev.alternativas, { letra: nextLetter, texto: '' }]
      };
    });
  };

  const handleRemoveAlternativa = (index: number) => {
    setFormState((prev) => {
      const alternativas = prev.alternativas.filter((_, idx) => idx !== index);
      return {
        ...prev,
        alternativas,
        resposta_correta: alternativas.some((alt) => alt.letra === prev.resposta_correta)
          ? prev.resposta_correta
          : alternativas[0]?.letra ?? 'A'
      };
    });
  };

  return (
    <main className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Questões</h1>
          <p className="text-muted">CRUD de questões e edição rápida.</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          <i className="fas fa-plus me-2" /> Nova questão
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Carregando...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Enunciado</th>
                    <th>Tipo</th>
                    <th>Disciplina</th>
                    <th>Concursos</th>
                    <th>Status</th>
                    <th className="text-end">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {questoes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
                        Nenhuma questão encontrada.
                      </td>
                    </tr>
                  ) : questoes.map((questao) => (
                    <tr key={questao.id}>
                      <td>{questao.enunciado.slice(0, 90)}...</td>
                      <td>{questao.tipo.replace('_', ' ')}</td>
                      <td>{questao.disciplina ?? '-'}</td>
                      <td>{questao.concursos.join(', ') || '-'}</td>
                      <td>{questao.ativo ? 'Ativo' : 'Inativo'}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => abrirModal(questao)}>
                          <i className="fas fa-edit" />
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(questao.id)}>
                          <i className="fas fa-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="modal d-block" tabIndex={-1} role="dialog">
          <div className="modal-dialog modal-xl" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{formState.id ? 'Editar questão' : 'Nova questão'}</h5>
                <button type="button" className="btn-close" onClick={() => setModalOpen(false)} aria-label="Fechar" />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Tipo</label>
                    <select
                      className="form-select"
                      value={formState.tipo}
                      onChange={(event) => handleTipoChange(event.target.value as FormState['tipo'])}
                    >
                      <option value="verdadeiro_falso">Verdadeiro/Falso</option>
                      <option value="multipla_escolha">Múltipla escolha</option>
                      <option value="redacao">Redação</option>
                    </select>
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">Enunciado</label>
                    <textarea
                      className="form-control"
                      value={formState.enunciado}
                      onChange={(event) => setFormState((prev) => ({ ...prev, enunciado: event.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Disciplina</label>
                    <input
                      className="form-control"
                      value={formState.disciplina}
                      onChange={(event) => setFormState((prev) => ({ ...prev, disciplina: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Assunto</label>
                    <input
                      className="form-control"
                      value={formState.assunto}
                      onChange={(event) => setFormState((prev) => ({ ...prev, assunto: event.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Nível</label>
                    <select
                      className="form-select"
                      value={formState.nivel}
                      onChange={(event) => setFormState((prev) => ({ ...prev, nivel: event.target.value as FormState['nivel'] }))}
                    >
                      <option value="basico">Básico</option>
                      <option value="intermediario">Intermediário</option>
                      <option value="avancado">Avançado</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Concursos (slugs)</label>
                    <input
                      className="form-control"
                      value={formState.concursos}
                      onChange={(event) => setFormState((prev) => ({ ...prev, concursos: event.target.value }))}
                      placeholder="sedf-2023, policia-2025"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Tags</label>
                    <input
                      className="form-control"
                      value={formState.tags}
                      onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
                      placeholder="ética, direito"
                    />
                  </div>

                  {formState.tipo === 'verdadeiro_falso' && (
                    <div className="col-12">
                      <label className="form-label">Resposta correta</label>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="respVF"
                          checked={formState.resposta_correta_boolean}
                          onChange={() => setFormState((prev) => ({ ...prev, resposta_correta_boolean: true }))}
                        />
                        <label className="form-check-label">Verdadeiro</label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="respVF"
                          checked={!formState.resposta_correta_boolean}
                          onChange={() => setFormState((prev) => ({ ...prev, resposta_correta_boolean: false }))}
                        />
                        <label className="form-check-label">Falso</label>
                      </div>
                    </div>
                  )}

                  {formState.tipo === 'multipla_escolha' && (
                    <>
                      <div className="col-12">
                        <label className="form-label">Alternativas</label>
                      </div>
                      {formState.alternativas.map((alternativa, index) => (
                        <div className="col-md-6 d-flex gap-2 align-items-start" key={alternativa.letra}>
                          <div className="flex-grow-1">
                            <label className="form-label">{alternativa.letra}</label>
                            <input
                              className="form-control"
                              value={alternativa.texto}
                              onChange={(event) => handleAlternativaChange(index, event.target.value)}
                            />
                          </div>
                          {formState.alternativas.length > 2 && (
                            <button
                              type="button"
                              className="btn btn-outline-danger mt-4"
                              onClick={() => handleRemoveAlternativa(index)}
                            >
                              <i className="fas fa-trash-alt" />
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="col-12">
                        <button type="button" className="btn btn-sm btn-outline-primary mb-3" onClick={handleAddAlternativa}>
                          <i className="fas fa-plus me-2" /> Adicionar alternativa
                        </button>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Resposta correta</label>
                        <select
                          className="form-select"
                          value={formState.resposta_correta}
                          onChange={(event) => setFormState((prev) => ({ ...prev, resposta_correta: event.target.value }))}
                        >
                          {formState.alternativas.map((alt) => (
                            <option key={alt.letra} value={alt.letra}>{alt.letra}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {formState.tipo === 'redacao' && (
                    <>
                      <div className="col-md-6">
                        <label className="form-label">Linhas mínimas</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formState.limite_linhas_min}
                          onChange={(event) => setFormState((prev) => ({ ...prev, limite_linhas_min: Number(event.target.value) }))}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Linhas máximas</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formState.limite_linhas_max}
                          onChange={(event) => setFormState((prev) => ({ ...prev, limite_linhas_max: Number(event.target.value) }))}
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Critérios de avaliação</label>
                        <input
                          className="form-control"
                          value={formState.criterios_avaliacao}
                          onChange={(event) => setFormState((prev) => ({ ...prev, criterios_avaliacao: event.target.value }))}
                          placeholder="adequação, coesão, norma culta"
                        />
                      </div>
                    </>
                  )}

                  <div className="col-12">
                    <label className="form-label">Fonte</label>
                    <input
                      className="form-control"
                      value={formState.fonte}
                      onChange={(event) => setFormState((prev) => ({ ...prev, fonte: event.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Explicação</label>
                    <textarea
                      className="form-control"
                      value={formState.explicacao}
                      onChange={(event) => setFormState((prev) => ({ ...prev, explicacao: event.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="col-12">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={formState.ativo}
                        onChange={(event) => setFormState((prev) => ({ ...prev, ativo: event.target.checked }))}
                        id="ativo"
                      />
                      <label className="form-check-label" htmlFor="ativo">
                        Ativo
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave}>
                  Salvar questão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
