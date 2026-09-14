// Rodada 18 — cache de DADO (não só de arquivo estático).
// Persiste o cache do React Query no localStorage para que Web, WebView do
// Capacitor e a janela do Electron mostrem o último dado conhecido em vez de
// tela de erro quando abrem sem internet.
import type { QueryClient } from '@tanstack/react-query';

const KEY = 'midias:query-cache';
const MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 dias

type Dehydrated = { ts: number; queries: { key: unknown; data: unknown; updatedAt: number }[] };

export function restoreQueryCache(client: QueryClient) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Dehydrated;
    if (!parsed?.queries || Date.now() - parsed.ts > MAX_AGE) return;
    parsed.queries.forEach(q => {
      if (q.data === undefined) return;
      client.setQueryData(q.key as any, q.data, { updatedAt: q.updatedAt });
    });
  } catch { /* cache corrompido é descartado silenciosamente */ }
}

export function persistQueryCache(client: QueryClient) {
  const save = () => {
    try {
      const queries = client.getQueryCache().getAll()
        .filter(q => q.state.status === 'success' && q.state.data !== undefined)
        .slice(-120)
        .map(q => ({ key: q.queryKey, data: q.state.data, updatedAt: q.state.dataUpdatedAt }));
      localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), queries } satisfies Dehydrated));
    } catch { /* quota cheia: cache offline é melhor-esforço */ }
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 1500);
  });
  window.addEventListener('pagehide', save);
  return unsubscribe;
}
