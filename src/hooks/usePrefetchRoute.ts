import { useCallback } from 'react';

// Mapa de rotas → loader dinâmico do chunk lazy correspondente.
// Importante: as chaves devem casar com as paths reais usadas no app.
const loaders: Record<string, () => Promise<unknown>> = {
  '/catalogo': () => import('@/pages/Catalogo'),
  '/ofertas': () => import('@/pages/Ofertas'),
  '/em-alta': () => import('@/pages/EmAlta'),
  '/pra-voce': () => import('@/pages/ParaVoce'),
  '/social': () => import('@/pages/SocialLibrary'),
  '/torneios': () => import('@/pages/Torneios'),
  '/biblioteca': () => import('@/pages/Biblioteca'),
  '/perfil': () => import('@/pages/Perfil'),
  '/favoritos': () => import('@/pages/Favoritos'),
  '/pedidos': () => import('@/pages/Pedidos'),
  '/oportunidades': () => import('@/pages/Oportunidades'),
  '/jogo': () => import('@/pages/GameDetail'),
  // Mobile
  '/m/forum': () => import('@/mobile/pages/MForum'),
  '/m/marketplace': () => import('@/mobile/pages/MMarketplace'),
  '/m/chat': () => import('@/mobile/pages/MChat'),
  '/m/profile': () => import('@/mobile/pages/MProfile'),
  '/m/favoritos': () => import('@/mobile/pages/MFavoritos'),
};

const prefetched = new Set<string>();

/**
 * Fase 6 — Prefetch de rotas. Dispara o `import()` do chunk lazy
 * em hover/touchstart para reduzir o tempo de transição.
 */
export function usePrefetchRoute() {
  return useCallback((path: string) => {
    // Casa por prefixo (ex.: /catalogo/algo → /catalogo)
    const key = Object.keys(loaders).find(k => path === k || path.startsWith(k + '/'));
    if (!key || prefetched.has(key)) return;
    prefetched.add(key);
    loaders[key]().catch(() => prefetched.delete(key));
  }, []);
}
