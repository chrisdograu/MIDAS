// Rodada 18 — leitura das preferências de visibilidade uniforme.
// Uma escolha de privacidade que a interface ignora é pior que nenhuma:
// este hook diz, para cada tipo de conteúdo, se o visitante atual pode ver.
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type Vis = 'public' | 'friends' | 'private';
export type ContentKind = 'opinions' | 'screenshots' | 'timeline' | 'reviews' | 'library';

const COL: Record<ContentKind, string> = {
  opinions: 'opinions_visibility',
  screenshots: 'screenshots_visibility',
  timeline: 'timeline_visibility',
  reviews: 'reviews_visibility',
  library: 'library_visibility',
};

// GAP-CV04: Visibilidade padrão por tipo
const DEFAULT_VISIBILITY: Record<ContentKind, Vis> = {
  opinions: 'friends',
  screenshots: 'friends',
  timeline: 'friends',
  reviews: 'friends',
  library: 'friends',
};

// GAP-CV01: Interface para cache
interface VisibilityCache {
  levels: Record<ContentKind, Vis>;
  isFriend: boolean;
  timestamp: number;
}

// GAP-CV01: TTL do cache (5 minutos)
const CACHE_TTL = 5 * 60 * 1000;

// GAP-CV01: Cache em memória
const visibilityCache = new Map<string, VisibilityCache>();

interface UseContentVisibilityOptions {
  /** GAP-CV04: Visibilidade padrão quando não configurada */
  defaultVisibility?: Partial<Record<ContentKind, Vis>>;
  /** GAP-CV01: Usar cache */
  useCache?: boolean;
  /** GAP-CV02: Habilitar Realtime */
  enableRealtime?: boolean;
}


  // Limpa cache global quando o usuário desloga
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        visibilityCache.clear();
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  const { 
    defaultVisibility = {},
    useCache = true,
    enableRealtime = true,
  } = options;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cacheKey = useMemo(() => `visibility-${ownerId}-${user?.id ?? 'anon'}`, [ownerId, user?.id]);

  // GAP-CV01: Buscar com cache
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['content-visibility', ownerId],
    queryFn: async () => {
      if (!ownerId) {
        return { levels: DEFAULT_VISIBILITY, isFriend: false };
      }

      // GAP-CV01: Verificar cache
      if (useCache) {
        const cached = visibilityCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          return cached;
        }
      }

      const [{ data: prof }, mutual] = await Promise.all([
        supabase.from('profiles')
          .select('opinions_visibility, screenshots_visibility, timeline_visibility, reviews_visibility, library_visibility')
          .eq('id', ownerId)
          .maybeSingle(),
        user && user.id !== ownerId
          ? (supabase as any).rpc('are_mutual_friends', { _a: user.id, _b: ownerId })
          : Promise.resolve({ data: false }),
      ]);

      const row = (prof || {}) as Record<string, string | null>;
      
      // GAP-CV04: Aplicar default visibility
      const levels: Record<ContentKind, Vis> = {
        opinions: (row.opinions_visibility as Vis) || defaultVisibility.opinions || DEFAULT_VISIBILITY.opinions,
        screenshots: (row.screenshots_visibility as Vis) || defaultVisibility.screenshots || DEFAULT_VISIBILITY.screenshots,
        timeline: (row.timeline_visibility as Vis) || defaultVisibility.timeline || DEFAULT_VISIBILITY.timeline,
        reviews: (row.reviews_visibility as Vis) || defaultVisibility.reviews || DEFAULT_VISIBILITY.reviews,
        library: (row.library_visibility as Vis) || defaultVisibility.library || DEFAULT_VISIBILITY.library,
      };

      const isFriend = !!(mutual as any)?.data;

      const result = { levels, isFriend };
      
      // GAP-CV01: Armazenar em cache
      if (useCache) {
        visibilityCache.set(cacheKey, { ...result, timestamp: Date.now() });
      }
      
      return result;
    },
    staleTime: CACHE_TTL,
    enabled: !!ownerId,
  });

  // GAP-CV02: Realtime subscription
  useEffect(() => {
    if (!enableRealtime || !ownerId) return;

    const channel = supabase
      .channel(`visibility-${ownerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${ownerId}`,
        },
        () => {
          // GAP-CV01: Invalidar cache
          visibilityCache.delete(cacheKey);
          queryClient.invalidateQueries({ queryKey: ['content-visibility', ownerId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerId, enableRealtime, cacheKey, queryClient]);

  const levels = data?.levels || DEFAULT_VISIBILITY;
  const isFriend = data?.isFriend || false;
  const loading = isLoading;

  // GAP-CV03: Função para verificar múltiplos owners
  const canViewAll = useCallback((kind: ContentKind, owners: string[]) => {
    if (!owners.length) return false;
    // Se todos são o próprio usuário, sempre pode
    if (user?.id && owners.every(id => id === user.id)) return true;
    // Se algum owner é diferente, NÃO podemos afirmar sem buscar
    // a visibilidade de cada um. Retornar false é o padrão SEGURO.
    // Para casos multi-owner, o caller deve usar canViewForOwner individualmente.
    return false;
  }, [user?.id]);

  const canView = useCallback((kind: ContentKind) => {
    if (!ownerId) return false;
    if (user?.id === ownerId) return true;
    const level = levels[kind];
    if (level === 'public') return true;
    if (level === 'private') return false;
    return isFriend;
  }, [ownerId, user?.id, levels, isFriend]);

  // GAP-CV03: Verificar visibilidade para múltiplos owners
  const canViewForOwner = useCallback((kind: ContentKind, targetOwnerId: string) => {
    // Próprio usuário sempre vê
    if (user?.id === targetOwnerId) return true;
    // Se é o mesmo owner do hook atual, usa a lógica existente
    if (targetOwnerId === ownerId) return canView(kind);
    // Para owner diferente, não temos dados de visibilidade dele aqui.
    // Retornar false é o padrão SEGURO. O caller deve criar um hook
    // específico para o outro owner se precisar ver conteúdo dele.
    return false;
  }, [ownerId, user?.id, canView]);

  return {
    canView,
    canViewForOwner,
    canViewAll,
    levels,
    isFriend,
    loading,
    refetch,
  };
}

/** Mensagem padrão quando o dono restringiu aquele conteúdo. */
export function ContentHidden({ label }: { label: string }) {
  return (
    <div className="border border-border rounded-lg p-6 text-center bg-card">
      <p className="text-sm font-medium text-foreground">{label} está restrito</p>
      <p className="text-xs text-muted-foreground mt-1">
        Esta pessoa escolheu limitar quem vê este conteúdo.
      </p>
    </div>
  );
}