const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function requestGroq(prompt: string, maxTokens = 1200): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

  if (!apiKey) {
    throw new Error('Groq API não configurada.');
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.7
        })
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? 2);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Groq erro ${response.status}: ${text}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('Resposta inesperada do Groq.');
      }
      return content;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError ?? new Error('Erro desconhecido no Groq.');
}

function extrairJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Nenhum JSON encontrado na resposta do Groq.');
  return JSON.parse(match[0]);
}

export async function gerarTema(disciplina: string) {
  const prompt = `Você é um examinador de concursos da banca Quadrix/Cebraspe.
Gere UM tema dissertativo curto (para comentário em até 30 linhas) sobre uma NOVIDADE ou tema recente relacionado a ${disciplina}.
Formato de saída JSON estrito:
{
  "titulo": "...",
  "enunciado": "...",
  "contexto": "...",
  "tres_aspectos": ["...", "...", "..."]
}
Não inclua nenhum texto fora do JSON.`;

  const content = await requestGroq(prompt, 600);
  return extrairJson(content);
}

export async function corrigirRedacao(tema: string, aspectos: string[], texto: string) {
  const prompt = `Você é um avaliador OFICIAL da banca Quadrix. Avalie a redação a seguir conforme os critérios da banca:
- Adequação ao tema e tipo textual (0-2.5)
- Coerência e coesão (0-2.5)
- Domínio da norma culta (0-2.5)
- Argumentação e abordagem dos aspectos solicitados (0-2.5)

Tema: ${tema}
Aspectos a abordar: ${aspectos.join(', ')}
Redação do candidato: ${texto}

Retorne SOMENTE este JSON:
{
  "nota_final": 0.0,
  "notas_criterios": {
    "adequacao": 0.0,
    "coerencia": 0.0,
    "norma_culta": 0.0,
    "argumentacao": 0.0
  },
  "pontos_fortes": ["..."],
  "pontos_a_melhorar": ["..."],
  "correcoes_especificas": [
    {"trecho": "...", "problema": "...", "sugestao": "..."}
  ],
  "comentario_geral": "..."
}`;

  const content = await requestGroq(prompt, 1500);
  return extrairJson(content);
}
