// Gera slots de horário dentro de uma janela com jitter aleatório de ±20 minutos

export function gerarSlots(
  horarioInicio: string, // 'HH:MM'
  horarioFim: string,    // 'HH:MM'
  quantidadeSlots: number,
  dataBrasilia: Date
): Date[] {
  const [hInicio, mInicio] = horarioInicio.split(':').map(Number);
  const [hFim, mFim] = horarioFim.split(':').map(Number);

  const inicioMin = hInicio * 60 + mInicio;
  const fimMin = hFim * 60 + mFim;
  const janelaMin = fimMin - inicioMin;

  if (janelaMin <= 0 || quantidadeSlots <= 0) return [];

  // Divide a janela em slots iguais
  const intervaloMin = Math.floor(janelaMin / quantidadeSlots);

  const slots: Date[] = [];
  for (let i = 0; i < quantidadeSlots; i++) {
    const baseMin = inicioMin + i * intervaloMin + Math.floor(intervaloMin / 2);
    const jitterMin = Math.floor(Math.random() * 41) - 20; // ±20 minutos
    const totalMin = Math.max(inicioMin, Math.min(fimMin - 1, baseMin + jitterMin));

    const slot = new Date(dataBrasilia);
    slot.setHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0);
    slots.push(slot);
  }

  return slots;
}

// Verifica se o horário atual está dentro de ±7 minutos de um slot
export function dentroDoSlot(slot: Date, agora: Date, toleranciaMin = 7): boolean {
  const diffMs = Math.abs(agora.getTime() - slot.getTime());
  return diffMs <= toleranciaMin * 60 * 1000;
}

// Retorna a data atual no timezone America/Sao_Paulo como objeto Date
export function agendaBrasilia(): Date {
  const brasiliaStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(brasiliaStr);
}
