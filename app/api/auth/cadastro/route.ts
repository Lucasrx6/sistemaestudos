import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const cadastroSchema = z.object({
  nome: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  telefone: z.string().optional().nullable(),
  concurso_ativo: z.string().optional().nullable(),
  preferencia_envio: z.enum(['whatsapp_direto', 'link_site', 'ambos']).default('ambos'),
  horario_inicio: z.string().optional().nullable(),
  horario_fim: z.string().optional().nullable(),
  envios_por_dia: z.number().min(1).max(8).default(2),
  perguntas_por_envio: z.number().min(1).max(10).default(3)
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = cadastroSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    nome,
    email,
    password,
    telefone,
    concurso_ativo,
    preferencia_envio,
    horario_inicio,
    horario_fim,
    envios_por_dia,
    perguntas_por_envio
  } = parsed.data;

  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { nome, telefone }
  });

  if (createUserError || !userData.user) {
    return NextResponse.json({ error: createUserError?.message || 'Erro ao criar usuário.' }, { status: 500 });
  }

  const { error: profileError } = await supabaseAdmin.from('usuarios').insert({
    id: userData.user.id,
    email,
    nome,
    telefone,
    concurso_ativo,
    preferencia_envio,
    notificacoes_ativas: true,
    horario_inicio,
    horario_fim,
    envios_por_dia,
    perguntas_por_envio
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
