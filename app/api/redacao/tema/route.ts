import { NextRequest, NextResponse } from 'next/server';
import { gerarTema } from '@/lib/groq/client';

function parseGroqJson(result: any) {
  const choice = result?.choices?.[0] ?? result?.data?.[0] ?? result;
  const text = choice?.text ?? choice?.message?.content ?? JSON.stringify(result);
  const candidate = typeof text === 'string' ? text.trim() : JSON.stringify(text);
  const match = candidate.match(/\{[\s\S]*\}$/);
  const jsonText = match ? match[0] : candidate;

  return JSON.parse(jsonText);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const disciplina = searchParams.get('disciplina') ?? 'direito';

  try {
    const response = await gerarTema(disciplina);
    const tema = parseGroqJson(response);

    return NextResponse.json({ ok: true, tema });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? 'Erro ao gerar tema.' }, { status: 500 });
  }
}
