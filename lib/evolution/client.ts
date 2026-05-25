export interface EvolutionTextPayload {
  number: string;
  text: string;
}

async function evolutionRequest(path: string, body: unknown): Promise<{ ok: boolean; data: unknown }> {
  const url = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_NAME;

  if (!url || !apiKey || !instance) {
    throw new Error('Evolution API não configurada. Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME.');
  }

  const endpoint = `${url.replace(/\/$/, '')}${path.replace(':instance', instance)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
  } catch (err) {
    throw new Error(`Evolution API falhou: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function enviarTexto(numero: string, mensagem: string) {
  // Normaliza número para formato internacional sem + ou espaços
  const numeroNormalizado = numero.replace(/\D/g, '');
  return evolutionRequest('/message/sendText/:instance', {
    number: numeroNormalizado,
    text: mensagem
  });
}

export async function enviarMensagens(numero: string, mensagens: string[]) {
  const resultados: Array<{ ok: boolean; data: unknown }> = [];
  for (const mensagem of mensagens) {
    const resultado = await enviarTexto(numero, mensagem);
    resultados.push(resultado);
    // Pausa breve entre mensagens para evitar flood
    if (mensagens.indexOf(mensagem) < mensagens.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return resultados;
}

// Divide texto longo em blocos de até maxLen caracteres respeitando quebras de linha
export function dividirMensagem(texto: string, maxLen = 4000): string[] {
  if (texto.length <= maxLen) return [texto];

  const blocos: string[] = [];
  const linhas = texto.split('\n');
  let bloco = '';

  for (const linha of linhas) {
    if ((bloco + '\n' + linha).trim().length > maxLen) {
      if (bloco.trim()) blocos.push(bloco.trim());
      bloco = linha;
    } else {
      bloco = bloco ? bloco + '\n' + linha : linha;
    }
  }
  if (bloco.trim()) blocos.push(bloco.trim());
  return blocos;
}
