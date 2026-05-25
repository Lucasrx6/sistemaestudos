'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      if (!adminEmail || !data.session?.user?.email) {
        setAuthorized(false);
        return;
      }

      if (data.session.user.email !== adminEmail) {
        setAuthorized(false);
        return;
      }

      setAuthorized(true);
    });
  }, []);

  if (authorized === null) {
    return (
      <main className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Verificando permissões...</span>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="container py-5">
        <div className="alert alert-danger">
          Acesso negado. Este recurso é exclusivo para administradores.
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
