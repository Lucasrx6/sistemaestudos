'use client';

import { useEffect, useState, FormEvent } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

type Concurso = { id: string; slug: string; nome: string; banca: string | null; ano: number | null };

type Perfil = {
  nome: string;
  email: string;
  telefone: string;
  // Melhoria 2: substituído concurso_ativo (único) por concursos_ativos (array)
  concursos_ativos: string[];
  preferencia_envio: string;
  notificacoes_ativas: boolean;
  horario_inicio: string;
  horario_fim: string;
  envios_por_dia: number;
  perguntas_por_envio: number;
  questoes_por_sessao: number;
  disciplinas_selecionadas: string[];
};

const preferencias = [
  { value: 'whatsapp_direto', label: 'WhatsApp direto (questões no chat)' },
  { value: 'link_site', label: 'Somente link para o site' },
  { value: 'ambos', label: 'Ambos (questões + link)' }
];

export default function ConfiguracoesPage() {
  const [perfil, setPerfil] = useState<Perfil>({
    nome: '',
    email: '',
    telefone: '',
    concursos_ativos: [],
    preferencia_envio: 'ambos',
    notificacoes_ativas: true,
    horario_inicio: '08:00',
    horario_fim: '20:00',
    envios_por_dia: 2,
    perguntas_por_envio: 3,
    questoes_por_sessao: 10,
    disciplinas_selecionadas: []
  });
  const [concursos, setConcursos] = useState<Concurso[]>([]);
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const t = data.session.access_token;
      setToken(t);

      const [perfilRes, concursosRes, disciplinasRes] = await Promise.all([
        fetch('/api/usuarios/perfil', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/admin/concursos'),
        fetch('/api/questoes/disciplinas')
      ]);

      const perfilData = await perfilRes.json();
      const concursosData = await concursosRes.json();
      const disciplinasData = await disciplinasRes.json();

      if (perfilData.ok && perfilData.usuario) {
        const u = perfilData.usuario;
        setPerfil({
          nome: u.nome ?? '',
          email: u.email ?? '',
          telefone: u.telefone ?? '',
          concursos_ativos: Array.isArray(u.concursos_ativos) ? u.concursos_ativos : [],
          preferencia_envio: u.preferencia_envio ?? 'ambos',
          notificacoes_ativas: u.notificacoes_ativas ?? true,
          horario_inicio: u.horario_inicio ?? '08:00',
          horario_fim: u.horario_fim ?? '20:00',
          envios_por_dia: u.envios_por_dia ?? 2,
          perguntas_por_envio: u.perguntas_por_envio ?? 3,
          questoes_por_sessao: u.questoes_por_sessao ?? 10,
          disciplinas_selecionadas: Array.isArray(u.disciplinas_selecionadas) ? u.disciplinas_selecionadas : []
        });
      }

      if (Array.isArray(concursosData)) setConcursos(concursosData);
      if (disciplinasData.ok && Array.isArray(disciplinasData.disciplinas)) {
        setDisciplinas(disciplinasData.disciplinas);
      }

      setLoading(false);
    });
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const response = await fetch('/api/usuarios/perfil', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        nome: perfil.nome,
        telefone: perfil.telefone || null,
        // Melhoria 2: envia concursos_ativos (array) em vez de concurso_ativo (único)
        concursos_ativos: perfil.concursos_ativos,
        preferencia_envio: perfil.preferencia_envio,
        notificacoes_ativas: perfil.notificacoes_ativas,
        horario_inicio: perfil.horario_inicio,
        horario_fim: perfil.horario_fim,
        envios_por_dia: perfil.envios_por_dia,
        perguntas_por_envio: perfil.perguntas_por_envio,
        questoes_por_sessao: perfil.questoes_por_sessao,
        disciplinas_selecionadas: perfil.disciplinas_selecionadas
      })
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(data.error?.message || 'Erro ao salvar configurações.');
    } else {
      setSuccess('Configurações salvas com sucesso!');
    }
  };

  const set = (field: keyof Perfil) => (value: unknown) => {
    setPerfil((prev) => ({ ...prev, [field]: value }));
    setSuccess(null);
  };

  // Melhoria 2: toggle de concurso no array concursos_ativos
  const toggleConcurso = (id: string) => {
    setPerfil((prev) => {
      const jaAtivo = prev.concursos_ativos.includes(id);
      return {
        ...prev,
        concursos_ativos: jaAtivo
          ? prev.concursos_ativos.filter((c) => c !== id)
          : [...prev.concursos_ativos, id]
      };
    });
    setSuccess(null);
  };

  const toggleDisciplina = (nome: string) => {
    setPerfil((prev) => {
      const jaAtiva = prev.disciplinas_selecionadas.includes(nome);
      return {
        ...prev,
        disciplinas_selecionadas: jaAtiva
          ? prev.disciplinas_selecionadas.filter((d) => d !== nome)
          : [...prev.disciplinas_selecionadas, nome]
      };
    });
    setSuccess(null);
  };

  if (loading) {
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
      <h1 className="h3 mb-4">Configurações</h1>

      <form onSubmit={handleSubmit}>
        {/* Dados pessoais */}
        <div className="card shadow-sm p-4 mb-4">
          <h2 className="h6 mb-3"><i className="fas fa-user me-2" />Dados pessoais</h2>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Nome</label>
              <input
                className="form-control"
                value={perfil.nome}
                onChange={(e) => set('nome')(e.target.value)}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input className="form-control" value={perfil.email} disabled readOnly />
              <div className="form-text">O email não pode ser alterado.</div>
            </div>
            <div className="col-md-6">
              <label className="form-label">Telefone (WhatsApp)</label>
              <input
                className="form-control"
                type="tel"
                placeholder="(11) 90000-0000"
                value={perfil.telefone}
                onChange={(e) => set('telefone')(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Melhoria 2: Provas ativas com checkboxes */}
        <div className="card shadow-sm p-4 mb-4">
          <h2 className="h6 mb-1"><i className="fas fa-graduation-cap me-2" />Provas ativas</h2>
          <p className="text-muted small mb-3">
            As questões serão selecionadas de todas as provas marcadas. Se nenhuma for selecionada, questões de qualquer concurso serão incluídas.
          </p>
          {concursos.length === 0 ? (
            <p className="text-muted small">Nenhum concurso cadastrado no sistema.</p>
          ) : (
            <div className="d-flex flex-column gap-2">
              {concursos.map((c) => (
                <div className="form-check" key={c.id}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`concurso-config-${c.id}`}
                    checked={perfil.concursos_ativos.includes(c.id)}
                    onChange={() => toggleConcurso(c.id)}
                  />
                  <label className="form-check-label" htmlFor={`concurso-config-${c.id}`}>
                    {c.nome}
                    {c.banca ? ` — ${c.banca}` : ''}
                    {c.ano ? ` (${c.ano})` : ''}
                  </label>
                </div>
              ))}
            </div>
          )}
          {perfil.concursos_ativos.length > 0 && (
            <div className="mt-2">
              <small className="text-primary">
                <i className="fas fa-check-circle me-1" />
                {perfil.concursos_ativos.length} prova(s) selecionada(s)
              </small>
            </div>
          )}
        </div>

        {/* Sessão de Estudo */}
        <div className="card shadow-sm p-4 mb-4">
          <h2 className="h6 mb-3"><i className="fas fa-book-open me-2" />Sessão de Estudo no Site</h2>
          
          <div className="mb-4">
            <label className="form-label d-flex justify-content-between">
              <span>Questões por rodada</span>
              <strong>{perfil.questoes_por_sessao}</strong>
            </label>
            <input
              type="range"
              className="form-range"
              min={5}
              max={50}
              step={5}
              value={perfil.questoes_por_sessao}
              onChange={(e) => set('questoes_por_sessao')(Number(e.target.value))}
            />
            <div className="d-flex justify-content-between text-muted small"><span>5</span><span>50</span></div>
          </div>

          <h3 className="h6 mb-2 mt-4">Disciplinas</h3>
          <p className="text-muted small mb-3">
            Selecione as disciplinas específicas que você deseja estudar. Se nenhuma for selecionada, o sistema trará todas mescladas.
          </p>
          {disciplinas.length === 0 ? (
            <p className="text-muted small">Nenhuma disciplina cadastrada no banco de dados.</p>
          ) : (
            <div className="border rounded p-3 d-flex flex-column gap-2" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {disciplinas.map((d) => (
                <div className="form-check mb-0" key={d}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`disciplina-${d}`}
                    checked={perfil.disciplinas_selecionadas.includes(d)}
                    onChange={() => toggleDisciplina(d)}
                  />
                  <label className="form-check-label" htmlFor={`disciplina-${d}`}>
                    {d}
                  </label>
                </div>
              ))}
            </div>
          )}
          {perfil.disciplinas_selecionadas.length > 0 && (
            <div className="mt-2">
              <small className="text-primary">
                <i className="fas fa-check-circle me-1" />
                {perfil.disciplinas_selecionadas.length} disciplina(s) selecionada(s)
              </small>
            </div>
          )}
        </div>

        {/* Notificações */}
        <div className="card shadow-sm p-4 mb-4">
          <h2 className="h6 mb-3"><i className="fas fa-bell me-2" />Notificações WhatsApp</h2>

          <div className="form-check form-switch mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="notificacoes"
              checked={perfil.notificacoes_ativas}
              onChange={(e) => set('notificacoes_ativas')(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="notificacoes">
              Ativar envio de questões por WhatsApp
            </label>
          </div>

          {perfil.notificacoes_ativas && (
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">Preferência de envio</label>
                <div className="d-flex flex-column gap-2">
                  {preferencias.map((p) => (
                    <div className="form-check" key={p.value}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name="preferencia"
                        id={p.value}
                        value={p.value}
                        checked={perfil.preferencia_envio === p.value}
                        onChange={() => set('preferencia_envio')(p.value)}
                      />
                      <label className="form-check-label" htmlFor={p.value}>{p.label}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label">Horário de início</label>
                <input
                  type="time"
                  className="form-control"
                  value={perfil.horario_inicio}
                  onChange={(e) => set('horario_inicio')(e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Horário de fim</label>
                <input
                  type="time"
                  className="form-control"
                  value={perfil.horario_fim}
                  onChange={(e) => set('horario_fim')(e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Questões por envio: <strong>{perfil.perguntas_por_envio}</strong>
                </label>
                <input
                  type="range"
                  className="form-range"
                  min={1}
                  max={10}
                  value={perfil.perguntas_por_envio}
                  onChange={(e) => set('perguntas_por_envio')(Number(e.target.value))}
                />
                <div className="d-flex justify-content-between text-muted small"><span>1</span><span>10</span></div>
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Envios por dia: <strong>{perfil.envios_por_dia}</strong>
                </label>
                <input
                  type="range"
                  className="form-range"
                  min={1}
                  max={8}
                  value={perfil.envios_por_dia}
                  onChange={(e) => set('envios_por_dia')(Number(e.target.value))}
                />
                <div className="d-flex justify-content-between text-muted small"><span>1</span><span>8</span></div>
              </div>
            </div>
          )}
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success"><i className="fas fa-check me-2" />{success}</div>}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-2" />Salvando...</> : <><i className="fas fa-save me-2" />Salvar configurações</>}
        </button>
      </form>
    </main>
  );
}
