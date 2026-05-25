import AuthGuard from '@/components/AuthGuard';
import AdminLink from '@/components/AdminLink';
import Link from 'next/link';

export const metadata = {
  title: 'Área do usuário - Sistema de Estudo'
};

const navLinks = [
  { href: '/dashboard',    icon: 'fa-home',       label: 'Dashboard' },
  { href: '/estudar',      icon: 'fa-book-open',  label: 'Estudar' },
  { href: '/redacao',      icon: 'fa-pen-nib',    label: 'Redação' },
  { href: '/estatisticas', icon: 'fa-chart-bar',  label: 'Estatísticas' },
  { href: '/configuracoes',icon: 'fa-sliders-h',  label: 'Config' }
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
        {/* Navbar sticky premium */}
        <header style={{
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          boxShadow: '0 2px 12px rgba(0,0,0,.06)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div className="container d-flex align-items-center justify-content-between py-2">
            {/* Brand */}
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <i className="fas fa-graduation-cap" style={{ color: '#fff', fontSize: '1rem' }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1d23', letterSpacing: '-0.02em' }}>
                StudyPro
              </span>
            </Link>

            {/* Nav links */}
            <nav className="d-none d-md-flex align-items-center gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href as any}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.4rem 0.85rem', borderRadius: '8px',
                    textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
                    color: '#374151', transition: 'all 0.2s'
                  }}
                  className="nav-link-item"
                >
                  <i className={`fas ${l.icon}`} style={{ fontSize: '0.8rem' }} />
                  {l.label}
                </Link>
              ))}
            </nav>

            {/* Admin + mobile nav */}
            <div className="d-flex align-items-center gap-2">
              <AdminLink />
              {/* Mobile burger — apenas visual, links via grid abaixo em mobile */}
              <div className="d-md-none d-flex gap-1">
                {navLinks.slice(0, 3).map((l) => (
                  <Link key={l.href} href={l.href as any} style={{ width: 36, height: 36, borderRadius: '8px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#374151' }}>
                    <i className={`fas ${l.icon}`} style={{ fontSize: '0.85rem' }} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="container py-4">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}

