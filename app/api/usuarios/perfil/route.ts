import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

const perfilUpdateSchema = z.object({
  nome: z.string().min(2).optional(),
  telefone: z.string().optional().nullable(),
  concurso_ativo: z.string().uuid().optional().nullable(),
  preferencia_envio: z.enum(['whatsapp_direto', 'link_site', 'ambos']).optional(),
  notificacoes_ativas: z.boolean().optional(),
  horario_inicio: z.string().optional().nullable(),
  horario_fim: z.string().optional().nullable(),
  envios_por_dia: z.number().int().min(1).max(8).optional(),
  perguntas_por_envio: z.number().int().min(1).max(10).optional()
});

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, telefone, concurso_ativo, preferencia_envio, notificacoes_ativas, horario_inicio, horario_fim, envios_por_dia, perguntas_por_envio')
    .eq('id', userData.user.id)
    .single();

  if (error || !usuario) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

  return NextResponse.json({ ok: true, usuario });
}

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

  const body = await request.json();
  const parsed = perfilUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { error: updateError } = await supabase
    .from('usuarios')
    .update(parsed.data)
    .eq('id', userData.user.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
