'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

type DisciplinaStat = { disciplina: string; acertos: number; erros: number; taxa: number };
type QuestaoErrada = { enunciado: string; disciplina: string | null; count: number };
type DiaAtividade = { dia: string; acertos: number; total: number };

type StatsCompletas = {
  total_acertos: number;
  total_erros: number;
  total_respostas: number;
  taxa_acerto: number;
  dias_estudados: number;
  streak: number;
};

export default function EstatisticasPage() {
  const [stats, setStats] = useState<StatsCompletas | null>(null);
  const [topErradas, setTopErradas] = useState<QuestaoErrada[]>([]);
  const [evolucao, setEvolucao] = useState<DiaAtividade[]>([]);
  const [disciplinas, setDisciplinas] = useState<DisciplinaStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const token = data.session.access_token;
      const usuarioId = data.session.user.id;

      // Dados gerais
      const statsRes = await fetch('/api/stats', { headers: { Authorization: `Bearer ${token}` } });
      const statsData = await statsRes.json();
      if (statsData.ok) {
        setStats(statsData.stats);
        setTopErradas(statsData.top_erradas ?? []);
        setEvolucao(statsData.evolucao ?? []);
      }

      // Estatísticas por disciplina via respostas diretas
      const respRes = await fetch(`/api/stats/disciplinas?usuario_id=${usuarioId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const respData = await respRes.json();
      if (respData.ok) setDisciplinas(respData.disciplinas ?? []);

      setLoading(false);
    });
  }, []);

  // Heatmap dos últimos 90 dias
  const heatmapDias = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(Date.now() - (89 - i) * 86400000);
    const dia = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const entry = evolucao.find((e) => e.dia === dia);
    return { dia, total: entry?.total ?? 0, taxa: entry ? (entry.acertos / entry.total) * 100 : -1 };
  });

  return (
    <main className="container py-4">
      <h1 className="h3 mb-4">Estatísticas</h1>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : (
        <div className="row g-4">
          {/* Resumo geral */}
          <div className="col-12">
            <div className="row g-3">
              {[
                { label: 'Total respondidas', value: stats?.total_respostas ?? 0, icon: 'fas fa-list', color: 'text-secondary' },
                { label: 'Taxa de acerto', value: `${stats?.taxa_acerto ?? 0}%`, icon: 'fas fa-percent', color: 'text-primary' },
                { label: 'Dias estudados', value: stats?.dias_estudados ?? 0, icon: 'fas fa-calendar-check', color: 'text-info' },
                { label: 'Sequência atual', value: `${stats?.streak ?? 0} dias`, icon: 'fas fa-fire', color: 'text-warning' }
              ].map((c) => (
                <div className="col-6 col-md-3" key={c.label}>
                  <div className="card shadow-sm p-3">
                    <div className="d-flex align-items-center gap-2">
                      <span className={`fs-3 ${c.color}`}><i className={c.icon} /></span>
                      <div>
                        <div className="text-muted small">{c.label}</div>
                        <strong>{String(c.value)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Taxa por disciplina */}
          <div className="col-lg-6">
            <div className="card shadow-sm p-4 h-100">
              <h2 className="h6 mb-3"><i className="fas fa-book me-2" />Taxa por disciplina</h2>
              {disciplinas.length === 0 ? (
                <p className="text-muted small">Sem dados suficientes ainda.</p>
              ) : (
                <div>
                  {disciplinas.map((d) => (
                    <div key={d.disciplina} className="mb-3">
                      <div className="d-flex justify-content-between small mb-1">
                        <span>{d.disciplina}</span>
                        <span className="text-muted">{d.acertos}/{d.acertos + d.erros} — {d.taxa}%</span>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div
                          className={`progress-bar ${d.taxa >= 70 ? 'bg-success' : d.taxa >= 40 ? 'bg-warning' : 'bg-danger'}`}
                          style={{ width: `${d.taxa}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top 10 mais erradas */}
          <div className="col-lg-6">
            <div className="card shadow-sm p-4 h-100">
              <h2 className="h6 mb-3"><i className="fas fa-exclamation-circle text-danger me-2" />Top questões mais erradas</h2>
              {topErradas.length === 0 ? (
                <p className="text-muted small">Nenhum erro registrado ainda.</p>
              ) : (
                <ol className="ps-3 mb-0">
                  {topErradas.map((q, i) => (
                    <li key={i} className="mb-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <span className="small fw-bold">{q.disciplina ?? 'Geral'}</span>
                        <span className="badge bg-danger ms-2">{q.count} erro(s)</span>
                      </div>
                      <div className="text-muted" style={{ fontSize: '12px' }}>{q.enunciado.slice(0, 80)}...</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          {/* Heatmap 90 dias */}
          <div className="col-12">
            <div className="card shadow-sm p-4">
              <h2 className="h6 mb-3"><i className="fas fa-calendar me-2" />Atividade — últimos 90 dias</h2>
              <div style={{ overflowX: 'auto' }}>
                <div className="d-flex gap-1 flex-wrap">
                  {heatmapDias.map((dia) => (
                    <div
                      key={dia.dia}
                      title={`${dia.dia}: ${dia.total} resposta(s)${dia.taxa >= 0 ? ` — ${Math.round(dia.taxa)}% acerto` : ''}`}
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '2px',
                        backgroundColor: dia.total === 0
                          ? '#e9ecef'
                          : dia.taxa >= 70
                          ? '#198754'
                          : dia.taxa >= 40
                          ? '#ffc107'
                          : '#dc3545'
                      }}
                    />
                  ))}
                </div>
                <div className="d-flex gap-3 mt-2 small text-muted">
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#e9ecef', borderRadius: '2px' }} /> Sem atividade</span>
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#198754', borderRadius: '2px' }} /> ≥70%</span>
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#ffc107', borderRadius: '2px' }} /> 40–69%</span>
                  <span><span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#dc3545', borderRadius: '2px' }} /> {'<'}40%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
