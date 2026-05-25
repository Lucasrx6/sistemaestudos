'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';

export default function AdminLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      if (!adminEmailsStr || !data.session?.user?.email) {
        return;
      }
      const adminEmails = adminEmailsStr.split(',').map(e => e.trim());
      if (adminEmails.includes(data.session.user.email)) {
        setIsAdmin(true);
      }
    });
  }, []);

  if (!isAdmin) return null;

  return (
    <Link href="/admin/questoes" className="btn btn-warning btn-sm fw-bold">
      <i className="fas fa-cog me-1" /> Painel Admin
    </Link>
  );
}
