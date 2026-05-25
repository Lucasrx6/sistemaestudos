/**
 * Simulador local do cron do Vercel.
 * Carrega .env.local e chama GET /api/cron/envios no intervalo configurado.
 *
 * Uso:
 *   npm run cron              → intervalo padrão (15 min)
 *   CRON_INTERVAL_MIN=1 npm run cron  → a cada 1 minuto (útil para teste rápido)
 */

import { readFileSync } from 'fs';

// Carrega .env.local sem dependências externas
try {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  console.warn('Aviso: .env.local não encontrado. Usando variáveis de ambiente do sistema.');
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SECRET = process.env.CRON_SECRET || '';
const INTERVAL_MIN = parseInt(process.env.CRON_INTERVAL_MIN || '15', 10);
const INTERVAL_MS = INTERVAL_MIN * 60 * 1000;

if (!SECRET) {
  console.error('Erro: CRON_SECRET não definido em .env.local');
  process.exit(1);
}

function timestamp() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

async function runCron() {
  console.log(`\n[${timestamp()}] Disparando ${BASE_URL}/api/cron/envios ...`);
  try {
    const res = await fetch(`${BASE_URL}/api/cron/envios`, {
      headers: { Authorization: `Bearer ${SECRET}` }
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`[${timestamp()}] ok — processados: ${data.processados ?? 0}`);
      if (Array.isArray(data.resultados) && data.resultados.length > 0) {
        for (const r of data.resultados) {
          console.log(`  usuario=${r.usuario_id?.slice(0, 8)}... enviado=${r.enviado} ${r.erro ? '| erro: ' + r.erro : ''}`);
        }
      }
    } else {
      console.error(`[${timestamp()}] Erro HTTP ${res.status}:`, JSON.stringify(data));
    }
  } catch (err) {
    console.error(`[${timestamp()}] Falha na requisição:`, err.message);
    console.error('  Verifique se "npm run dev" está rodando em outro terminal.');
  }
}

console.log(`=== Cron local iniciado ===`);
console.log(`URL:       ${BASE_URL}/api/cron/envios`);
console.log(`Intervalo: ${INTERVAL_MIN} min`);
console.log(`Dica:      CRON_INTERVAL_MIN=1 npm run cron para testar mais rápido`);
console.log(`Parar:     Ctrl+C`);

// Dispara imediatamente e depois no intervalo
runCron();
setInterval(runCron, INTERVAL_MS);
