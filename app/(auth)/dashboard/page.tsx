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

const cards = (stats: Stats | null, loading: boolean) => [
  {
    icon: 'fa-check-circle',
    iconCls: 'stat-icon-green',
    label: 'Total de Acertos',
    value: loading ? '—' : String(stats?.total_acertos ?? 0),
    sub: 'questões corretas'
  },
  {
    icon: 'fa-times-circle',
    iconCls: 'stat-icon-red',
    label: 'Total de Erros',
    value: loading ? '—' : String(stats?.total_erros ?? 0),
    sub: 'questões erradas'
  },
  {
    icon: 'fa-bullseye',
    iconCls: 'stat-icon-blue',
    label: 'Taxa de Acerto',
    value: loading ? '—' : `${stats?.taxa_acerto ?? 0}%`,
    sub: 'de aproveitamento'
  },
  {
    icon: 'fa-fire',
    iconCls: 'stat-icon-orange',
    label: 'Sequência',
    value: loading ? '—' : `${stats?.streak ?? 0}🔥`,
    sub: 'dias consecutivos'
  }
];

const quickLinks = [
  { href: '/estudar',     icon: 'fa-book-open',  iconBg: '#ede9fe', iconColor: '#4f46e5', label: 'Estudar questões', desc: 'Sessão personalizada' },
  { href: '/redacao',     icon: 'fa-pen-nib',    iconBg: '#d1fae5', iconColor: '#059669', label: 'Praticar redação', desc: 'Com correção por IA' },
  { href: '/estatisticas',icon: 'fa-chart-line', iconBg: '#dbeafe', iconColor: '#2563eb', label: 'Estatísticas',     desc: 'Ver desempenho completo' },
  { href: '/configuracoes',icon:'fa-sliders-h',  iconBg: '#fef3c7', iconColor: '#d97706', label: 'Configurações',    desc: 'Provas, sessão e perfil' }
];

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

  const statCards = cards(stats, loading);
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <main className="container py-4">

      {/* ── Hero / Saudação ── */}
      <div className="card hero-card mb-4 overflow-hidden" style={{ borderRadius: '20px' }}>
        <div className="card-body px-4 py-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <p className="mb-1 opacity-75" style={{ fontSize: '0.9rem' }}>
              <i className="fas fa-sun me-1" /> {saudacao}!
            </p>
            <h1 className="h3 mb-1 fw-700" style={{ color: '#fff' }}>
              {nomeUsuario ? nomeUsuario.split(' ')[0] : 'Estudante'} 👋
            </h1>
            <p className="mb-0 opacity-75 small">
              {stats?.streak && stats.streak > 0
                ? `Você está em uma sequência de ${stats.streak} dia(s)! Continue firme! 🔥`
                : 'Pronto para mais uma sessão de estudos?'}
            </p>
          </div>
          <Link href="/estudar" className="btn btn-light px-4 fw-700" style={{ color: '#4f46e5', borderRadius: '12px' }}>
            <i className="fas fa-play me-2" />Estudar agora
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="row g-3 mb-4">
        {statCards.map((c) => (
          <div className="col-6 col-md-3" key={c.label}>
            <div className="stat-card h-100">
              <div className="d-flex align-items-center gap-3 mb-2">
                <div className={`stat-icon ${c.iconCls}`}>
                  <i className={`fas ${c.icon}`} />
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
                  <div className="fw-700" style={{ fontSize: '1.5rem', lineHeight: 1.2 }}>{c.value}</div>
                </div>
              </div>
              <div className="text-muted" style={{ fontSize: '0.78rem' }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Evolução 14 dias (largura total, altura fixa) ── */}
      <div className="card p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h6 mb-0 fw-700">
            <i className="fas fa-chart-bar me-2 text-primary" />Evolução nos últimos 14 dias
          </h2>
          <span className="badge bg-light text-muted border small">
            <i className="fas fa-circle me-1" style={{ color: '#10b981' }} /> ≥70%
            <i className="fas fa-circle mx-1" style={{ color: '#f59e0b' }} /> ≥40%
            <i className="fas fa-circle me-1 ms-0" style={{ color: '#ef4444' }} /> &lt;40%
          </span>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: '120px' }}>
            <div className="spinner-border spinner-border-sm" />
          </div>
        ) : evolucao.length === 0 ? (
          <div className="text-center py-4">
            <i className="fas fa-chart-area fa-2x text-muted mb-2" style={{ display: 'block' }} />
            <p className="text-muted small mb-2">Nenhuma resposta registrada ainda.</p>
            <Link href="/estudar" className="btn btn-primary btn-sm">
              <i className="fas fa-play me-1" />Começar a estudar
            </Link>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Linhas de grade */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
              {[100, 75, 50, 25, 0].map(v => (
                <div key={v} style={{ borderTop: '1px dashed #e5e7eb', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: -9, fontSize: '9px', color: '#9ca3af', fontWeight: 600 }}>{v}%</span>
                </div>
              ))}
            </div>

            <div className="d-flex align-items-end gap-2 ps-5" style={{ height: '130px', overflowX: 'auto', paddingBottom: '4px' }}>
              {evolucao.map((dia) => {
                const taxa = dia.total > 0 ? (dia.acertos / dia.total) * 100 : 0;
                const altura = Math.max(6, Math.round(taxa * 1.1));
                const color = taxa >= 70 ? '#10b981' : taxa >= 40 ? '#f59e0b' : '#ef4444';
                return (
                  <div
                    key={dia.dia}
                    className="d-flex flex-column align-items-center flex-shrink-0"
                    title={`${dia.dia}: ${dia.acertos}/${dia.total} (${Math.round(taxa)}%)`}
                    style={{ minWidth: '38px', cursor: 'default' }}
                  >
                    <span style={{ fontSize: '9px', color: '#6b7280', marginBottom: '3px', fontWeight: 600 }}>
                      {Math.round(taxa)}%
                    </span>
                    <div style={{
                      height: `${altura}px`, width: '22px', background: color,
                      borderRadius: '6px 6px 0 0', transition: 'height .5s ease'
                    }} />
                    <span style={{ fontSize: '9px', color: '#9ca3af', marginTop: '3px' }}>
                      {dia.dia.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Questões mais erradas (cards horizontais) ── */}
      <div className="card p-4 mb-4">
        <h2 className="h6 mb-3 fw-700">
          <i className="fas fa-exclamation-circle text-danger me-2" />Questões mais erradas
        </h2>
        {loading ? (
          <div className="loading-screen" style={{ minHeight: '60px' }}>
            <div className="spinner-border spinner-border-sm" />
          </div>
        ) : topErradas.length === 0 ? (
          <div className="text-center py-3">
            <i className="fas fa-trophy fa-2x text-warning mb-2" style={{ display: 'block' }} />
            <p className="text-muted small mb-0">Nenhum erro registrado ainda. Continue assim! 🎉</p>
          </div>
        ) : (
          <div className="row g-3">
            {topErradas.map((q, i) => (
              <div className="col-md-4" key={i}>
                <div style={{
                  background: '#fff9f9', border: '1px solid #fee2e2',
                  borderLeft: '4px solid #ef4444', borderRadius: '12px', padding: '0.85rem'
                }}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge bg-danger">{q.count}× errada</span>
                    {q.disciplina && (
                      <span className="badge bg-light text-dark border" style={{ fontSize: '0.7rem' }}>
                        <i className="fas fa-book-open me-1" />{q.disciplina}
                      </span>
                    )}
                  </div>
                  <p className="mb-0 text-muted" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                    {q.enunciado.slice(0, 100)}{q.enunciado.length > 100 ? '…' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Acesso rápido ── */}
      <div className="card p-4">
        <h2 className="h6 mb-3 fw-700">
          <i className="fas fa-bolt text-warning me-2" />Acesso rápido
        </h2>
        <div className="row g-3">
          {quickLinks.map((q) => (
            <div className="col-6 col-md-3" key={q.href}>
              <a href={q.href} className="quick-card">
                <div className="quick-card-icon" style={{ background: q.iconBg }}>
                  <i className={`fas ${q.icon}`} style={{ color: q.iconColor }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{q.label}</div>
                  <div className="text-muted" style={{ fontSize: '0.78rem' }}>{q.desc}</div>
                </div>
              </a>
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}
