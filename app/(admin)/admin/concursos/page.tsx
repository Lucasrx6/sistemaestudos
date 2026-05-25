'use client';

import { useEffect, useState } from 'react';

type ConcursoAdmin = {
  id: string;
  slug: string;
  nome: string;
  banca: string | null;
  ano: number | null;
};

type ConcursoFormState = {
  id?: string;
  slug: string;
  nome: string;
  banca: string;
  ano?: number;
};

const initialFormState: ConcursoFormState = {
  id: undefined,
  slug: '',
  nome: '',
  banca: '',
  ano: undefined
};

export default function AdminConcursosPage() {
  const [concursos, setConcursos] = useState<ConcursoAdmin[]>([]);
  const [formState, setFormState] = useState<ConcursoFormState>(initialFormState);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchConcursos = async () => {
    setLoading(true);
    const response = await fetch('/api/admin/concursos');
    const data = await response.json();
    setConcursos(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchConcursos();
  }, []);

  const abrirModal = (concurso?: ConcursoAdmin) => {
    setError(null);
    setSuccess(null);

    if (!concurso) {
      setFormState(initialFormState);
      setModalOpen(true);
      return;
    }

    setFormState({
      id: concurso.id,
      slug: concurso.slug,
      nome: concurso.nome,
      banca: concurso.banca ?? '',
      ano: concurso.ano ?? undefined
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);

    const body = {
      ...formState,
      banca: formState.banca.trim() || null,
      ano: formState.ano ?? null
    };

    const response = await fetch('/api/admin/concursos', {
      method: formState.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(data.error?.message || 'Erro ao salvar concurso.');
      return;
    }

    setSuccess('Concurso salvo com sucesso.');
    setModalOpen(false);
    fetchConcursos();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja excluir este concurso?')) return;
    setLoading(true);
    await fetch(`/api/admin/concursos?id=${id}`, { method: 'DELETE' });
    fetchConcursos();
  };

  return (
    <main className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Concursos</h1>
          <p className="text-muted">Administração dos concursos cadastrados.</p>
        </div>
        <button className="btn btn-primary" onClick={() => abrirModal()}>
          <i className="fas fa-plus me-2" /> Novo concurso
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
                    <th>Nome</th>
                    <th>Slug</th>
                    <th>Banca</th>
                    <th>Ano</th>
                    <th className="text-end">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {concursos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        Nenhum concurso cadastrado.
                      </td>
                    </tr>
                  ) : concursos.map((concurso) => (
                    <tr key={concurso.id}>
                      <td>{concurso.nome}</td>
                      <td>{concurso.slug}</td>
                      <td>{concurso.banca ?? '-'}</td>
                      <td>{concurso.ano ?? '-'}</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => abrirModal(concurso)}>
                          <i className="fas fa-edit" />
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(concurso.id)}>
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
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{formState.id ? 'Editar concurso' : 'Novo concurso'}</h5>
                <button type="button" className="btn-close" onClick={() => setModalOpen(false)} aria-label="Fechar" />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Nome</label>
                  <input
                    className="form-control"
                    value={formState.nome}
                    onChange={(event) => setFormState((prev) => ({ ...prev, nome: event.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Slug</label>
                  <input
                    className="form-control"
                    value={formState.slug}
                    onChange={(event) => setFormState((prev) => ({ ...prev, slug: event.target.value }))}
                    placeholder="identificador-unico"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Banca</label>
                  <input
                    className="form-control"
                    value={formState.banca}
                    onChange={(event) => setFormState((prev) => ({ ...prev, banca: event.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Ano</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formState.ano ?? ''}
                    onChange={(event) => setFormState((prev) => ({ ...prev, ano: event.target.value ? Number(event.target.value) : undefined }))}
                    placeholder="2025"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar concurso'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
