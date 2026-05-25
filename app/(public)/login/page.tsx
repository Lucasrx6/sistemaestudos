'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';

const SAVED_EMAIL_KEY = 'sistemaprova:saved_email';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [lembrar, setLembrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // true enquanto verifica sessão existente

  // Verifica sessão ativa e pré-preenche email salvo
  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/dashboard');
        return;
      }
      const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setLembrar(true);
      }
      setLoading(false);
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (lembrar) {
      localStorage.setItem(SAVED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }
    router.push('/dashboard');
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4f46e5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center text-white">
          <div className="spinner-border mb-3" role="status" />
          <p style={{ opacity: 0.7 }}>Verificando sessão...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4f46e5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo / Brand */}
        <div className="text-center mb-4">
          <div style={{ width: 64, height: 64, borderRadius: '18px', background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(10px)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <i className="fas fa-graduation-cap fa-2x" style={{ color: '#fff' }} />
          </div>
          <h1 className="h4 fw-700 mb-1" style={{ color: '#fff' }}>Sistema de Estudos</h1>
          <p style={{ color: 'rgba(255,255,255,.65)', fontSize: '0.9rem' }}>
            Concursos Públicos — Acesse sua conta
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ borderRadius: '20px', boxShadow: '0 24px 64px rgba(0,0,0,.35)', border: 'none' }}>
          <div className="card-body p-4">

            <h2 className="h5 fw-700 mb-4 d-flex align-items-center gap-2">
              <i className="fas fa-sign-in-alt text-purple" /> Entrar
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-700 small" htmlFor="email">
                  <i className="fas fa-envelope me-1 text-muted" /> E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label fw-700 small" htmlFor="password">
                  <i className="fas fa-lock me-1 text-muted" /> Senha
                </label>
                <div className="input-group">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ borderRight: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPass(!showPass)}
                    style={{ borderLeft: 'none', borderRadius: '0 10px 10px 0' }}
                    tabIndex={-1}
                  >
                    <i className={`fas ${showPass ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="form-check mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="lembrar"
                    checked={lembrar}
                    onChange={(e) => setLembrar(e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="lembrar">
                    Lembrar meu e-mail
                  </label>
                </div>
              </div>

              {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                  <i className="fas fa-exclamation-circle" /> {error}
                </div>
              )}

              <button type="submit" className="btn btn-primary w-100 py-2 fw-700" disabled={loading}>
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-2" />Entrando...</>
                  : <><i className="fas fa-sign-in-alt me-2" />Entrar</>}
              </button>
            </form>

            <hr className="my-3" />
            <p className="text-center text-muted small mb-0">
              Não tem conta?{' '}
              <Link href="/cadastro" className="fw-700 text-purple" style={{ textDecoration: 'none' }}>
                Criar conta grátis <i className="fas fa-arrow-right ms-1" />
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center mt-3" style={{ color: 'rgba(255,255,255,.45)', fontSize: '0.78rem' }}>
          <i className="fas fa-shield-alt me-1" /> Seus dados estão seguros e protegidos.
        </p>
      </div>
    </main>
  );
}
