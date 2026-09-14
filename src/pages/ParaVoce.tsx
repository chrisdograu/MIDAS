import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { mapProdutoToGame, Game } from '@/lib/gameData';
import GameCard from '@/components/GameCard';
import { Sparkles, Gamepad2, X, ChevronLeft, ChevronRight, Users, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GameCardGridSkeleton } from '@/components/skeletons';
import EstadoVazio from '@/components/EstadoVazio';
import { toast } from 'sonner';
import { useState, useRef, useEffect } from 'react';
import { dbWrite } from '@/lib/dbWrite';

// GAP-542: Tabela de recomendações ignoradas
async function getIgnoredRecommendations(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('recommendation_ignores' as any)
    .select('product_id')
    .eq('user_id', userId);
  return new Set((data || []).map((r: any) => r.product_id));
}

async function ignoreRecommendation(userId: string, productId: string) {
  await dbWrite(
    supabase
      .from('recommendation_ignores' as any)
      .insert({ user_id: userId, product_id: productId })
  );
}

// GAP-546: Buscar recomendações de amigos
async function fetchFriendRecommendations(userId: string): Promise<Game[]> {
  // Buscar amigos
  const { data: convs } = await supabase
    .from('conversas')
    .select('participant_1, participant_2')
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .eq('status', 'accepted');
  
  const friendIds = new Set<string>();
  (convs || []).forEach((c: any) => {
    friendIds.add(c.participant_1 === userId ? c.participant_2 : c.participant_1);
  });
  friendIds.delete(userId);
  
  if (friendIds.size === 0) return [];
  
  // Buscar jogos que amigos têm e o usuário não
  const { data: friendLib } = await supabase
    .from('biblioteca_usuario')
    .select('product_id')
    .in('user_id', [...friendIds]);
  
  const friendProductIds = new Set((friendLib || []).map((r: any) => r.product_id));
  
  // Buscar produtos que o usuário já tem
  const { data: myLib } = await supabase
    .from('biblioteca_usuario')
    .select('product_id')
    .eq('user_id', userId);
  const myProductIds = new Set((myLib || []).map((r: any) => r.product_id));
  
  // Buscar produtos que amigos têm mas o usuário não
  const productIds = [...friendProductIds].filter(id => !myProductIds.has(id));
  if (productIds.length === 0) return [];
  
  const { data: products } = await supabase
    .from('produtos')
    .select('*')
    .in('id', productIds.slice(0, 20))
    .eq('is_active', true)
    .eq('awaiting_first_stock', false)
    .order('rating', { ascending: false })
    .limit(10);
  
  return (products || []).map(mapProdutoToGame);
}

// GAP-543: Função para garantir diversidade de gêneros
function ensureGenreDiversity(recommendations: Record<string, Game[]>, maxPerGenre: number = 5): Game[] {
  const result: Game[] = [];
  const genres = Object.keys(recommendations);
  
  // Se tem mais de 2 gêneros, pegar pelo menos 2 de cada
  const shuffledGenres = [...genres].sort(() => Math.random() - 0.5);
  
  // Pegar no máximo 2 gêneros para diversidade
  const selectedGenres = shuffledGenres.slice(0, Math.min(2, shuffledGenres.length));
  
  for (const genre of selectedGenres) {
    const games = recommendations[genre] || [];
    const slice = games.slice(0, maxPerGenre);
    result.push(...slice);
  }
  
  // Se ainda tiver espaço, preencher com outros gêneros
  if (result.length < 10 && genres.length > 2) {
    const remainingGenres = shuffledGenres.slice(2);
    for (const genre of remainingGenres) {
      if (result.length >= 10) break;
      const games = recommendations[genre] || [];
      const slice = games.slice(0, Math.min(3, 10 - result.length));
      result.push(...slice);
    }
  }
  
  return result.slice(0, 10);
}

// GAP-545: Componente de carrossel
function RecommendationCarousel({ 
  games, 
  title, 
  onIgnore,
  ignoredIds,
}: { 
  games: Game[]; 
  title: string; 
  onIgnore: (id: string) => void;
  ignoredIds: Set<string>;
}) {
  const [scrollIndex, setScrollIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsPerView = 5;
  const totalPages = Math.ceil(games.length / itemsPerView);
  
  const visibleGames = games.slice(
    scrollIndex * itemsPerView,
    (scrollIndex + 1) * itemsPerView
  );
  
  const canScrollLeft = scrollIndex > 0;
  const canScrollRight = scrollIndex < totalPages - 1;
  
  const scrollToIndex = (index: number) => {
    setScrollIndex(Math.max(0, Math.min(index, totalPages - 1)));
  };
  
  // GAP-544: Já visto (simulado com localStorage)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('para_voce_seen') || '[]');
      setSeenIds(new Set(stored));
    } catch {
      setSeenIds(new Set());
    }
  }, []);
  
  const markAsSeen = (id: string) => {
    const newSeen = new Set(seenIds);
    newSeen.add(id);
    setSeenIds(newSeen);
    try {
      localStorage.setItem('para_voce_seen', JSON.stringify([...newSeen]));
    } catch {}
  };
  
  if (games.length === 0) return null;
  
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => scrollToIndex(scrollIndex - 1)}
              disabled={!canScrollLeft}
              className="p-1 rounded border border-border hover:border-primary/40 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              {scrollIndex + 1}/{totalPages}
            </span>
            <button
              onClick={() => scrollToIndex(scrollIndex + 1)}
              disabled={!canScrollRight}
              className="p-1 rounded border border-border hover:border-primary/40 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div ref={containerRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {visibleGames.map(game => {
          const isSeen = seenIds.has(game.id);
          const isIgnored = ignoredIds.has(game.id);
          
          if (isIgnored) return null;
          
          return (
            <div key={game.id} className="relative group">
              <div onClick={() => markAsSeen(game.id)}>
                <GameCard game={game} />
              </div>
              {/* GAP-544: Badge "Já viu" */}
              {isSeen && (
                <span className="absolute top-2 left-2 text-[10px] font-semibold bg-background/80 backdrop-blur text-foreground px-1.5 py-0.5 rounded-full border border-border flex items-center gap-0.5">
                  <Eye className="h-2.5 w-2.5" /> Visto
                </span>
              )}
              {/* GAP-542: Botão "Não tenho interesse" */}
              <button
                onClick={() => onIgnore(game.id)}
                className="absolute top-2 right-2 p-1 rounded-full bg-background/80 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                title="Não tenho interesse"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
              <p className="text-[10px] text-primary/80 italic px-1 mt-1 line-clamp-1">
                {title}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function fetchRecommendations(userId: string): Promise<Record<string, Game[]>> {
  const { data: lib } = await supabase
    .from('biblioteca_usuario')
    .select('product_id, produtos(category)')
    .eq('user_id', userId);
  const counts = new Map<string, number>();
  const ownedIds = new Set<string>();
  ((lib as any) || []).forEach((r: any) => {
    ownedIds.add(r.product_id);
    const c = r.produtos?.category;
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  });
  const topGenres = [...counts.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
  const result: Record<string, Game[]> = {};
  for (const g of topGenres) {
    const { data } = await supabase.from('produtos').select('*').eq('category', g).eq('is_active', true).eq('awaiting_first_stock', false).order('rating', { ascending: false }).limit(10);
    result[g] = (data || []).filter(p => !ownedIds.has(p.id)).map(mapProdutoToGame);
  }
  return result;
}

export default function ParaVoce() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // GAP-542: Recomendações ignoradas
  const { data: ignoredIds = new Set<string>() } = useQuery({
    queryKey: ['para-voce-ignored', user?.id],
    queryFn: () => getIgnoredRecommendations(user!.id),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  
  const { data: byGenre = {}, isLoading } = useQuery({
    queryKey: ['pra-voce', user?.id],
    queryFn: () => fetchRecommendations(user!.id),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  
  // GAP-546: Recomendações de amigos
  const { data: friendRecs = [], isLoading: friendLoading } = useQuery({
    queryKey: ['pra-voce-friends', user?.id],
    queryFn: () => fetchFriendRecommendations(user!.id),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  
  // GAP-542: Mutation para ignorar recomendação
  const ignoreMutation = useMutation({
    mutationFn: (productId: string) => ignoreRecommendation(user!.id, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['para-voce-ignored', user?.id] });
      toast.info('Recomendação removida');
    },
    onError: () => {
      toast.error('Erro ao remover recomendação');
    },
  });
  
  // GAP-543: Garantir diversidade de gêneros
  const diverseRecommendations = useQuery({
    queryKey: ['pra-voce-diverse', user?.id, byGenre],
    enabled: !!user && Object.keys(byGenre).length > 0,
    queryFn: () => {
      return ensureGenreDiversity(byGenre, 4);
    },
    staleTime: 5 * 60_000,
  });
  
  // GAP-545: Estado para carrossel
  const [carouselIndex, setCarouselIndex] = useState(0);
  
  const handleIgnore = (productId: string) => {
    ignoreMutation.mutate(productId);
  };

  if (!user) return (
    <div className="container mx-auto px-4 py-20 text-center">
      <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">Pra Você</h1>
      <p className="text-muted-foreground mb-4">Entre para ver recomendações baseadas na sua biblioteca.</p>
      <Link to="/auth" className="text-primary hover:underline">Entrar</Link>
    </div>
  );
  
  // Filtra recomendações ignoradas
  const filteredDiverse = (diverseRecommendations.data || []).filter(
    g => !ignoredIds.has(g.id)
  );
  
  // Filtra recomendações de amigos
  const filteredFriendRecs = (friendRecs || []).filter(
    g => !ignoredIds.has(g.id)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-display font-bold">Pra Você</h1>
          <p className="text-muted-foreground text-sm">Recomendações baseadas nos seus gêneros favoritos</p>
        </div>
      </div>
      
      {isLoading ? (
        <GameCardGridSkeleton count={10} />
      ) : Object.keys(byGenre).length === 0 && filteredFriendRecs.length === 0 ? (
        <EstadoVazio
          icone={Gamepad2}
          titulo="Ainda sem recomendações"
          descricao="Tenha pelo menos 3 jogos do mesmo gênero na biblioteca para ver recomendações personalizadas."
          acao={{ label: 'Adicionar jogos', to: '/catalogo' }}
        />
      ) : (
        <div className="space-y-10">
          {/* GAP-545: Carrossel de recomendações por gênero */}
          {Object.entries(byGenre).map(([genre, games]) => {
            const filtered = games.filter(g => !ignoredIds.has(g.id));
            if (filtered.length === 0) return null;
            return (
              <RecommendationCarousel
                key={genre}
                games={filtered}
                title={`Porque você curte ${genre}`}
                onIgnore={handleIgnore}
                ignoredIds={ignoredIds}
              />
            );
          })}
          
          {/* GAP-543: Diversidade — se tiver mais de 2 gêneros, mostrar seção "Mais diversidade" */}
          {diverseRecommendations.data && diverseRecommendations.data.length > 0 && Object.keys(byGenre).length > 2 && (
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" /> 
                Expandindo seus horizontes
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredDiverse.slice(0, 5).map(game => (
                  <div key={game.id} className="relative group">
                    <GameCard game={game} />
                    <button
                      onClick={() => handleIgnore(game.id)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-background/80 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                      title="Não tenho interesse"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                    <p className="text-[10px] text-accent/80 italic px-1 mt-1">
                      Novidade para você
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {/* GAP-546: Recomendações de amigos */}
          {filteredFriendRecs.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> 
                Seus amigos também curtem
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredFriendRecs.slice(0, 5).map(game => (
                  <div key={game.id} className="relative group">
                    <GameCard game={game} />
                    <button
                      onClick={() => handleIgnore(game.id)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-background/80 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                      title="Não tenho interesse"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                    <p className="text-[10px] text-primary/80 italic px-1 mt-1 line-clamp-1">
                      Amigos estão jogando
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}