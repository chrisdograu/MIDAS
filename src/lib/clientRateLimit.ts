// Rate limiter client-side simples via localStorage. Não é defesa de segurança
// (defesa real é no banco / edge), é UX: impede que o usuário martele um botão
// e evita gastar chamadas de auth do Supabase por engano ou por bot besta.
// Item 116 — cobrir login, redefinição de senha e denúncia.

type Bucket = { count: number; resetAt: number };

const KEY = (name: string) => `rl:${name}`;

export interface RateLimitConfig {
  name: string;
  max: number;
  windowMs: number;
}

export function checkRateLimit({ name, max, windowMs }: RateLimitConfig):
  { ok: true } | { ok: false; retryInSec: number } {
  if (typeof window === 'undefined') return { ok: true };
  const now = Date.now();
  let bucket: Bucket | null = null;
  try {
    const raw = window.localStorage.getItem(KEY(name));
    if (raw) bucket = JSON.parse(raw) as Bucket;
  } catch { /* ignore */ }
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 1, resetAt: now + windowMs };
    try { window.localStorage.setItem(KEY(name), JSON.stringify(bucket)); } catch {}
    return { ok: true };
  }
  if (bucket.count >= max) {
    return { ok: false, retryInSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  try { window.localStorage.setItem(KEY(name), JSON.stringify(bucket)); } catch {}
  return { ok: true };
}

export const RL = {
  LOGIN: { name: 'auth:login', max: 5, windowMs: 60_000 },        // 5/min
  RESET: { name: 'auth:reset', max: 3, windowMs: 60 * 60_000 },   // 3/hora
  REPORT: { name: 'report', max: 5, windowMs: 5 * 60_000 },       // 5/5min
} as const;
