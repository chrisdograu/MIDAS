import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRadarDelta } from '@/hooks/useRadarDelta';
import { useMutualFriends } from '@/hooks/useFriendActivity';

import GameCard from '@/components/GameCard';
import { mapProdutoToGame, type Game } from '@/lib/gameData';
import { Percent, Rocket, Target, Sparkles, ChevronRight, Clock } from 'lucide-react';
import { GameCardGridSkeleton } from '@/components/skeletons';
import { cn } from '@/lib/utils';

interface Shelf {
  id: string;
  title: string;
  icon: React.ReactNode;
  evidence: string;
  games: Game[];
  weight: number;
  count: number;
}

// GAP-OC01: Chave para localStorage
const SHELF_ORDER_KEY = 'opportunity-shelf-order';

async function fetchByIds(ids: string[]): Promise<Game[]> {
  if (!ids.length) return [];
  const { data } = await supabase
    .from('produtos')
    .select('*')
    .in('id', ids)
    .eq('is_active', true)
    .gt('stock', 0);
  const map = new Map((data || []).map((r: any) => [r.id, mapProdutoToGame(r)]));
  return ids.map(id => map.get(id)).filter((g): g is Game => !!g);
}

export default function OpportunityCenter() {
  const { user } = useAuth();
  const { data: radar = [] } = useRadarDelta(8);
  const { data: friendIds = [] } = useMutualFriends();

  // GAP-OC01: Ordem personalizada das prateleiras
  const [shelfOrder, setShelfOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(SHELF_ORDER_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [shelfVisibility, setShelfVisibility] = useState<Record<string, boolean>>({});

  // Big deals
  const dealsQ = useQuery({
    queryKey: ['opp-deals'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('produtos')
        .select('*')
        .eq('is_active', true)
        .gt('stock', 0)
        .gt('discount', 0)
        .order('discount', { ascending: false })
        .limit(8);
      return (data || []).map((r: any) => mapProdutoToGame(r));
    },
  });

  // Movement (from radar)
  const movementQ = useQuery({
    queryKey: ['opp-movement', radar.map(r => r.product_id).join(',')],
    enabled: radar.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => fetchByIds(radar.map(r => r.product_id)),
  });

  // Próximos da sua órbita
  const orbitQ = useQuery({
    queryKey: ['opp-orbit', user?.id, friendIds.length],
    enabled: !!user && friendIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [{ data: libs }, { data: mine }] = await Promise.all([
        supabase.from('biblioteca_usuario').select('product_id').in('user_id', friendIds).limit(40),
        supabase.from('biblioteca_usuario').select('product_id').eq('user_id', user!.id),
      ]);
      const owned = new Set((mine || []).map((r: any) => r.product_id));
      const counts = new Map<string, number>();
      (libs || []).forEach((r: any) => {
        if (owned.has(r.product_id)) return;
        counts.set(r.product_id, (counts.get(r.product_id) || 0) + 1);
      });
      const ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
      return fetchByIds(ids);
    },
  });

  // Fora da sua bolha
  const bubbleQ = useQuery({
    queryKey: ['opp-outside', user?.id],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      let excludedCats: string[] = [];
      if (user) {
        const { data: lib } = await supabase
          .from('biblioteca_usuario')
          .select('product_id')
          .eq('user_id', user.id)
          .limit(30);
        const ids = (lib || []).map((r: any) => r.product_id);
        if (ids.length) {
          const { data: cats } = await supabase.from('produtos').select('category').in('id', ids);
          excludedCats = [...new Set((cats || []).map((r: any) => r.category).filter(Boolean))];
        }
      }
      let q = supabase
        .from('produtos')
        .select('*')
        .eq('is_active', true)
        .gt('stock', 0)
        .gte('rating', 4.25)
        .order('rating', { ascending: false })
        .limit(8);
      if (excludedCats.length) {
        const escaped = excludedCats.map(c => `"${c.replace(/"/g, '')}"`).join(',');
        q = q.not('category', 'in', `(${escaped})`);
      }
      const { data } = await q;
      return (data || []).map((r: any) => mapProdutoToGame(r));
    },
  });

  const shelves = useMemo<Shelf[]>(() => {
    const arr: Shelf[] = [];
    if (dealsQ.data?.length) {
      const top = Math.max(...dealsQ.data.map(g => g.discount));
      arr.push({
        id: 'deals',
        title: '💰 Grandes Oportunidades',
        icon: <Percent className="h-4 w-4 text-price" />,
        evidence: `Maior desconto agora: −${top}%`,
        games: dealsQ.data,
        weight: dealsQ.data.length * 1.5,
        count: dealsQ.data.length,
      });
    }
    if (movementQ.data?.length) {
      arr.push({
        id: 'move',
        title: '🚀 Em Movimento',
        icon: <Rocket className="h-4 w-4 text-primary" />,
        evidence: `Calor recente em ${movementQ.data.length} jogos (24–72h)`,
        games: movementQ.data,
        weight: movementQ.data.length * 2,
        count: movementQ.data.length,
      });
    }
    if (orbitQ.data?.length) {
      arr.push({
        id: 'orbit',
        title: '🎯 Próximos da Sua Órbita',
        icon: <Target className="h-4 w-4 text-accent" />,
        evidence: `Jogos populares entre seus amigos próximos`,
        games: orbitQ.data,
        weight: orbitQ.data.length * 1.2,
        count: orbitQ.data.length,
      });
    }
    if (bubbleQ.data?.length) {
      arr.push({
        id: 'bubble',
        title: '✨ Fora da Sua Bolha',
        icon: <Sparkles className="h-4 w-4 text-accent" />,
        evidence: `Aclamados (≥4.25★) em categorias que você não costuma jogar`,
        games: bubbleQ.data,
        weight: bubbleQ.data.length,
        count: bubbleQ.data.length,
      });
    }

    // GAP-OC01: Aplicar ordem personalizada
    if (shelfOrder.length > 0) {
      arr.sort((a, b) => {
        const idxA = shelfOrder.indexOf(a.id);
        const idxB = shelfOrder.indexOf(b.id);
        if (idxA === -1 && idxB === -1) return b.weight - a.weight;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    } else {
      arr.sort((a, b) => b.weight - a.weight);
    }

    return arr;
  }, [dealsQ.data, movementQ.data, orbitQ.data, bubbleQ.data, shelfOrder]);

  const anyLoading = dealsQ.isLoading || movementQ.isLoading || orbitQ.isLoading || bubbleQ.isLoading;

  // GAP-OC03: Fallback para prateleira vazia
  if (!anyLoading && shelves.length === 0) {
    return (
      <section className="container mx-auto px-4 pt-8">
        <div className="rounded-xl border border-border/60 bg-card/50 p-5 text-sm text-muted-foreground italic text-center">
          🛰️ Sem oportunidades quentes agora. Volte mais tarde.
        </div>
      </section>
    );
  }

  // GAP-OC02: Loading skeleton individual por shelf
  const renderSkeletonShelves = () => (
    <div className="space-y-10">
      {Array.from({ length: 2 }).map((_, s) => (
        <section key={s} className="container mx-auto px-4">
          <div className="h-6 w-56 rounded bg-muted/50 animate-pulse mb-2" />
          <div className="h-3 w-72 rounded bg-muted/40 animate-pulse mb-4" />
          <GameCardGridSkeleton count={6} />
        </section>
      ))}
    </div>
  );

  // GAP-OC05: Animação de entrada das shelves
  const visibleShelves = shelves.filter(s => shelfVisibility[s.id] !== false);

  return (
    <div className="space-y-10">
      {anyLoading && shelves.length === 0 ? (
        renderSkeletonShelves()
      ) : (
        visibleShelves.map((shelf, index) => {
          // GAP-OC07: Indicador de novidade
          const hasRecentGame = shelf.games.some(g => {
            const daysSinceAdd = g.createdAt
              ? (Date.now() - new Date(g.createdAt).getTime()) / (1000 * 60 * 60 * 24)
              : Infinity;
            return daysSinceAdd < 7;
          });

          return (
            <section
              key={shelf.id}
              className={cn(
                'container mx-auto px-4 transition-all duration-500',
                'opacity-100 translate-y-0'
              )}
              style={{
                transitionDelay: `${index * 100}ms`,
              }}
            >
              <header className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    {shelf.icon}
                    {shelf.title}
                    {/* GAP-OC04: Contador de itens */}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({shelf.count} jogos)
                    </span>
                    {/* GAP-OC07: Badge de novidade */}
                    {hasRecentGame && (
                      <span className="text-[8px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> Novo
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{shelf.evidence}</p>
                </div>
                {/* GAP-OC06: Link "Ver mais" com filtro persistente */}
                <Link
                  to={`/catalogo?tab=${shelf.id}`}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                  state={{ fromOpportunity: true, shelfId: shelf.id }}
                >
                  Ver mais <ChevronRight className="h-4 w-4" />
                </Link>
              </header>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {shelf.games.slice(0, 6).map((g, i) => (
                  <GameCard key={g.id} game={g} index={i} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}