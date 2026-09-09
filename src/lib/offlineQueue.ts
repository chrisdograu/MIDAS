// Rodada 18 — fila de ações offline.
// Guarda ações simples (favoritar, avaliar, postar) no localStorage quando não
// há rede e reenvia assim que a conexão volta. Nada de perder a ação do usuário
// nem travar a UI esperando o servidor.
import { supabase } from '@/integrations/supabase/client';

export type OfflineAction = {
  id: string;
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  match?: Record<string, unknown>;
  label: string;
  createdAt: number;
};

const KEY = 'midias:offline-queue';
const listeners = new Set<(items: OfflineAction[]) => void>();

export function readQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfflineAction[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineAction[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* quota */ }
  listeners.forEach(l => l(items));
}

export function subscribeQueue(fn: (items: OfflineAction[]) => void) {
  listeners.add(fn);
  fn(readQueue());
  return () => { listeners.delete(fn); };
}

export function enqueueAction(action: Omit<OfflineAction, 'id' | 'createdAt'>) {
  const item: OfflineAction = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  writeQueue([...readQueue(), item]);
  return item;
}

async function runAction(a: OfflineAction) {
  const q = supabase.from(a.table as any);
  if (a.op === 'insert') return q.insert(a.payload as any);
  if (a.op === 'update') return q.update(a.payload as any).match((a.match || {}) as any);
  return q.delete().match((a.match || {}) as any);
}

let flushing = false;

/** Reenvia tudo que está pendente. Mantém na fila o que continuar falhando. */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  if (flushing || !navigator.onLine) return { sent: 0, failed: 0 };
  flushing = true;
  const items = readQueue();
  const remaining: OfflineAction[] = [];
  let sent = 0;
  for (const item of items) {
    try {
      const { error } = (await runAction(item)) as { error: unknown };
      if (error) remaining.push(item); else sent += 1;
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  flushing = false;
  return { sent, failed: remaining.length };
}

/** Executa online; se estiver sem rede, enfileira e devolve `queued: true`. */
export async function runOrQueue(action: Omit<OfflineAction, 'id' | 'createdAt'>) {
  if (!navigator.onLine) {
    enqueueAction(action);
    return { queued: true as const, error: null };
  }
  try {
    const { error } = (await runAction({ ...action, id: 'tmp', createdAt: Date.now() })) as { error: unknown };
    if (error) return { queued: false as const, error };
    return { queued: false as const, error: null };
  } catch (error) {
    enqueueAction(action);
    return { queued: true as const, error: null };
  }
}

export function startOfflineQueueWatcher() {
  window.addEventListener('online', () => { void flushQueue(); });
  if (navigator.onLine) void flushQueue();
}
