'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';

type Stats = {
  total_acertos: number;
  total_erros: number;
  total_respostas: number;
  taxa_acerto: number;
  dias_estudados: number;
  streak: number;
};

type DiaEvolucao = { dia: string; acertos: number; total: number };
type QuestaoErrada = { enunciado: string; disciplina: string | null; count: number };

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [evolucao, setEvolucao] = useState<DiaEvolucao[]>([]);
  const [topErradas, setTopErradas] = useState<QuestaoErrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState('');

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const token = data.session.access_token;
      setNomeUsuario(data.session.user.user_metadata?.nome ?? data.session.user.email ?? '');

      const response = await fetch('/api/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.ok) {
        setStats(result.stats);
        setEvolucao(result.evolucao);
        setTopErradas(result.top_erradas);
      }
      setLoading(false);
    });
  }, []);

  const cards = [
    {
      icon: 'fas fa-check-circle',
      color: 'text-success',
      label: 'Acertos',
      value: loading ? '—' : String(stats?.total_acertos ?? 0)
    },
    {
      icon: 'fas fa-times-circle',
      color: 'text-danger',
      label: 'Erros',
      value: loading ? '—' : String(stats?.total_erros ?? 0)
    },
    {
      icon: 'fas fa-percent',
      color: 'text-primary',
      label: 'Taxa de acerto',
      value: loading ? '—' : `${stats?.taxa_acerto ?? 0}%`
    },
    {
      icon: 'fas fa-fire',
      color: 'text-warning',
      label: 'Dias seguidos',
      value: loading ? '—' : String(stats?.streak ?? 0)
    }
  ];

  return (
    <main className="container py-4">
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h1 className="h3 mb-0">Dashboard</h1>
          {nomeUsuario && <p className="text-muted mb-0">Olá, {nomeUsuario.split(' ')[0]}!</p>}
        </div>
        <Link href="/estudar" className="btn btn-primary">
          <i className="fas fa-play me-2" />Estudar agora
        </Link>
      </div>

      {/* Cards de estatísticas */}
      <div className="row g-3 mb-4">
        {cards.map((card) => (
          <div className="col-6 col-md-3" key={card.label}>
            <div className="card shadow-sm h-100 p-3">
              <div className="d-flex align-items-center gap-3">
                <span className={`fs-2 ${card.color}`}><i className={card.icon} /></span>
                <div>
                  <div className="text-muted small">{card.label}</div>
                  <strong className="fs-5">{card.value}</strong>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        {/* Evolução 14 dias */}
        <div className="col-lg-8">
          <div className="card shadow-sm p-4">
            <h2 className="h6 mb-3">Evolução nos últimos 14 dias</h2>
            {loading ? (
              <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
            ) : evolucao.length === 0 ? (
              <p className="text-muted small">Nenhuma resposta registrada ainda. <Link href="/estudar">Comece estudando!</Link></p>
            ) : (
              <div className="d-flex align-items-end gap-1" style={{ height: '120px', overflowX: 'auto' }}>
                {evolucao.map((dia) => {
                  const taxa = dia.total > 0 ? (dia.acertos / dia.total) * 100 : 0;
                  const altura = Math.max(8, Math.round(taxa * 1.1));
                  return (
                    <div key={dia.dia} className="d-flex flex-column align-items-center flex-shrink-0" style={{ minWidth: '32px' }} title={`${dia.dia}: ${dia.acertos}/${dia.total}`}>
                      <div
                        className={`rounded-top w-100 ${taxa >= 70 ? 'bg-success' : taxa >= 40 ? 'bg-warning' : 'bg-danger'}`}
                        style={{ height: `${altura}px` }}
                      />
                      <span className="text-muted" style={{ fontSize: '9px' }}>{dia.dia.slice(0, 5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Questões mais erradas */}
        <div className="col-lg-4">
          <div className="card shadow-sm p-4">
            <h2 className="h6 mb-3"><i className="fas fa-exclamation-circle text-danger me-2" />Mais erradas</h2>
            {loading ? (
              <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
            ) : topErradas.length === 0 ? (
              <p className="text-muted small">Nenhum erro registrado ainda.</p>
            ) : (
              <ol className="ps-3 mb-0">
                {topErradas.map((q, i) => (
                  <li key={i} className="mb-2">
                    <div className="small fw-bold">{q.disciplina ?? 'Geral'} <span className="badge bg-danger ms-1">{q.count}×</span></div>
                    <div className="text-muted" style={{ fontSize: '12px' }}>{q.enunciado.slice(0, 70)}...</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Links rápidos */}
        <div className="col-12">
          <div className="card shadow-sm p-4">
            <h2 className="h6 mb-3">Acesso rápido</h2>
            <div className="d-flex flex-wrap gap-2">
              <Link href="/estudar" className="btn btn-outline-primary btn-sm">
                <i className="fas fa-book-open me-2" />Estudar questões
              </Link>
              <Link href="/redacao" className="btn btn-outline-secondary btn-sm">
                <i className="fas fa-pen me-2" />Praticar redação
              </Link>
              <Link href="/estatisticas" className="btn btn-outline-info btn-sm">
                <i className="fas fa-chart-bar me-2" />Ver estatísticas completas
              </Link>
              <Link href="/configuracoes" className="btn btn-outline-secondary btn-sm">
                <i className="fas fa-cog me-2" />Configurações
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
