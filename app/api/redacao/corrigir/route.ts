import { NextRequest, NextResponse } from 'next/server';
import { corrigirRedacao } from '@/lib/groq/client';

function parseGroqJson(result: any) {
  const choice = result?.choices?.[0] ?? result?.data?.[0] ?? result;
  const text = choice?.text ?? choice?.message?.content ?? JSON.stringify(result);
  const candidate = typeof text === 'string' ? text.trim() : JSON.stringify(text);
  const match = candidate.match(/\{[\s\S]*\}$/);
  const jsonText = match ? match[0] : candidate;

  return JSON.parse(jsonText);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tema, aspectos, texto } = body;

  if (!tema || !texto || !Array.isArray(aspectos) || aspectos.length === 0) {
    return NextResponse.json({ ok: false, error: 'Tema, aspectos e texto são obrigatórios.' }, { status: 400 });
  }

  try {
    const response = await corrigirRedacao(tema, aspectos, texto);
    const resultado = parseGroqJson(response);
    return NextResponse.json({ ok: true, resultado });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao corrigir redação.' }, { status: 500 });
  }
}
