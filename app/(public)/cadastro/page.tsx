'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Concurso = { id: string; slug: string; nome: string; banca: string | null; ano: number | null };

const preferencias = [
  { value: 'whatsapp_direto', label: 'WhatsApp direto (questões no chat)' },
  { value: 'link_site', label: 'Somente link para o site' },
  { value: 'ambos', label: 'Ambos' }
];

export default function CadastroPage() {
  const router = useRouter();
  const [concursos, setConcursos] = useState<Concurso[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [concursoAtivo, setConcursoAtivo] = useState('');
  const [preferencia, setPreferencia] = useState('ambos');
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('20:00');
  const [perguntasPorEnvio, setPerguntasPorEnvio] = useState(3);
  const [enviosPorDia, setEnviosPorDia] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/concursos')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setConcursos(data); })
      .catch(() => {});
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch('/api/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        telefone: telefone || null,
        email,
        password,
        concurso_ativo: concursoAtivo || null,
        preferencia_envio: preferencia,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        envios_por_dia: enviosPorDia,
        perguntas_por_envio: perguntasPorEnvio
      })
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error?.message || 'Erro ao criar conta.');
      return;
    }

    router.push('/login');
  }

  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-7 col-md-9">
          <div className="card shadow-sm">
            <div className="card-body">
              <h1 className="h4 mb-1">Criar conta</h1>
              <p className="text-muted small mb-4">Sistema de estudo para concursos públicos</p>
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="nome">Nome completo</label>
                    <input id="nome" type="text" className="form-control" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="telefone">Telefone (WhatsApp)</label>
                    <input id="telefone" type="tel" className="form-control" placeholder="(11) 90000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                    <div className="form-text">Usado para envio de questões.</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="email">Email</label>
                    <input id="email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="password">Senha</label>
                    <input id="password" type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="concursoAtivo">Concurso ativo</label>
                    <select id="concursoAtivo" className="form-select" value={concursoAtivo} onChange={(e) => setConcursoAtivo(e.target.value)}>
                      <option value="">Selecionar concurso (opcional)</option>
                      {concursos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} {c.banca ? `— ${c.banca}` : ''} {c.ano ? `(${c.ano})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <hr className="my-4" />
                <h2 className="h6 mb-3">Preferências de envio WhatsApp</h2>

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Formato de envio</label>
                    <div className="d-flex flex-column gap-2">
                      {preferencias.map((p) => (
                        <div className="form-check" key={p.value}>
                          <input
                            className="form-check-input"
                            type="radio"
                            name="preferencia"
                            id={p.value}
                            value={p.value}
                            checked={preferencia === p.value}
                            onChange={(e) => setPreferencia(e.target.value)}
                          />
                          <label className="form-check-label" htmlFor={p.value}>{p.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="horarioInicio">Horário de início</label>
                    <input id="horarioInicio" type="time" className="form-control" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="horarioFim">Horário de fim</label>
                    <input id="horarioFim" type="time" className="form-control" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="perguntasPorEnvio">
                      Questões por envio: <strong>{perguntasPorEnvio}</strong>
                    </label>
                    <input
                      id="perguntasPorEnvio"
                      type="range"
                      className="form-range"
                      min={1}
                      max={10}
                      value={perguntasPorEnvio}
                      onChange={(e) => setPerguntasPorEnvio(Number(e.target.value))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="enviosPorDia">
                      Envios por dia: <strong>{enviosPorDia}</strong>
                    </label>
                    <input
                      id="enviosPorDia"
                      type="range"
                      className="form-range"
                      min={1}
                      max={8}
                      value={enviosPorDia}
                      onChange={(e) => setEnviosPorDia(Number(e.target.value))}
                    />
                  </div>
                </div>

                {error && <div className="alert alert-danger mt-3">{error}</div>}

                <button type="submit" className="btn btn-primary w-100 mt-4" disabled={loading}>
                  {loading ? <><span className="spinner-border spinner-border-sm me-2" />Criando conta...</> : 'Criar conta'}
                </button>
              </form>
              <p className="mt-3 text-center">
                Já tem conta? <Link href="/login">Faça login</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
