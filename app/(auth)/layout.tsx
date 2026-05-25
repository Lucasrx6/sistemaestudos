import AuthGuard from '@/components/AuthGuard';
import AdminLink from '@/components/AdminLink';
import Link from 'next/link';

export const metadata = {
  title: 'Área do usuário - Sistema de Estudo'
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="container py-4">
        <header className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
          <div>
            <h1 className="h4">Área do usuário</h1>
            <p className="text-muted mb-0">Acesse seu painel de estudos e recursos.</p>
          </div>
          <nav className="d-flex flex-wrap gap-2 mt-3 mt-md-0">
            <Link href="/dashboard" className="btn btn-outline-secondary btn-sm">Dashboard</Link>
            <Link href="/estudar" className="btn btn-outline-secondary btn-sm">Estudar</Link>
            <Link href="/redacao" className="btn btn-outline-secondary btn-sm">Redação</Link>
            <Link href="/estatisticas" className="btn btn-outline-secondary btn-sm">Estatísticas</Link>
            <Link href="/configuracoes" className="btn btn-outline-secondary btn-sm">Configurações</Link>
            <AdminLink />
          </nav>
        </header>
        {children}
      </div>
    </AuthGuard>
  );
}
