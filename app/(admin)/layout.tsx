import AdminGuard from '@/components/AdminGuard';
import Link from 'next/link';

export const metadata = {
  title: 'Administração - Sistema de Estudo'
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="container py-4">
        <header className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
          <div>
            <h1 className="h4">Admin</h1>
            <p className="text-muted mb-0">Gerencie questões, concursos e importações.</p>
          </div>
          <nav className="d-flex flex-wrap gap-2 mt-3 mt-md-0">
            <Link href="/admin/questoes" className="btn btn-outline-secondary btn-sm">Questões</Link>
            <Link href="/admin/concursos" className="btn btn-outline-secondary btn-sm">Concursos</Link>
            <Link href="/admin/importar" className="btn btn-outline-secondary btn-sm">Importar JSON</Link>
          </nav>
        </header>
        {children}
      </div>
    </AdminGuard>
  );
}
