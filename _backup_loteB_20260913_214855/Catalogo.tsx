import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { platforms } from "@/lib/gameData";
import { useProdutos } from "@/hooks/useProdutos";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import GameCard from "@/components/GameCard";
import BundleStoreGrid from "@/components/BundleStoreGrid";
import { GameCardGridSkeleton, GameCardListSkeleton } from "@/components/skeletons";
import { Search, Package, X, EyeOff, SearchX, List, Grid3X3, Star, Calendar, RefreshCw } from "lucide-react";
import EstadoVazio from "@/components/EstadoVazio";
import ErroCarregamento from "@/components/ErroCarregamento";
import { useAuth } from "@/hooks/useAuth";
import { dbWrite } from '@/lib/dbWrite';
import SelectSimples from '@/components/SelectSimples';
import { Link } from 'react-router-dom';

const PRICE_MIN = 0;
const PRICE_MAX = 500;
const ITEMS_PER_PAGE = 24;

// GAP-007: Componente de timestamp
function LastUpdated({ time }: { time: Date }) {
  return (
    <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
      <RefreshCw className="h-3 w-3" />
      Última atualização: {time.toLocaleString('pt-BR')}
    </p>
  );
}

// GAP-105, GAP-436: Componente de filtro por estrelas
function StarFilter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star === value ? 0 : star)} aria-label={`Filtrar por ${star} estrelas ou mais`} aria-pressed={star <= value}
          className={`text-lg transition-colors ${star <= value ? 'text-yellow-400' : 'text-muted-foreground/30'}`}
        >
          ★
        </button>
      ))}
      {value > 0 && (
        <span className="text-xs text-muted-foreground ml-1">{value}+ estrelas</span>
      )}
    </div>
  );
}

// GAP-106, GAP-437: Componente de filtro por ano
function YearFilter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  return (
    <SelectSimples
      value={value ? String(value) : 'todos'}
      onChange={(v) => onChange(v === 'todos' ? 0 : Number(v))}
      label="Ano de lançamento"
      options={[
        { value: 'todos', label: 'Todos os anos' },
        ...years.map(y => ({ value: String(y), label: String(y) })),
      ]}
    />
  );
}

// GAP-107, GAP-438: Componente de toggle grid/lista
function ViewToggle({ view, onChange }: { view: 'grid' | 'list'; onChange: (v: 'grid' | 'list') => void }) {
  return (
    <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
      <button aria-label="Visualizar em grade" aria-pressed={view === 'grid'} onClick={() => onChange('grid')} className={`p-1.5 rounded ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        <Grid3X3 className="h-4 w-4" />
      </button>
      <button aria-label="Visualizar em lista" aria-pressed={view === 'list'} onClick={() => onChange('list')} className={`p-1.5 rounded ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Catalogo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(searchParams.get("cat") || "Todos");
  const initialPlatforms = (searchParams.get("platforms") || "").split(",").filter(Boolean);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(initialPlatforms);
  const initialMin = Number(searchParams.get("pmin")) || PRICE_MIN;
  const initialMax = Number(searchParams.get("pmax")) || PRICE_MAX;
  const [priceMin, setPriceMin] = useState<number>(initialMin);
  const [priceMax, setPriceMax] = useState<number>(initialMax);
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "recent");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('catalogo-view-mode') as 'grid' | 'list') || 'grid';
  });
  // GAP-105, GAP-436: Filtro por avaliação mínima
  const [minRating, setMinRating] = useState<number>(0);
  // GAP-106, GAP-437: Filtro por ano
  const [yearFilter, setYearFilter] = useState<number>(0);
  const { data: games = [], isLoading, isError, refetch, isRefetching } = useProdutos();
  const { user } = useAuth();

  // Persistir view mode
  useEffect(() => {
    localStorage.setItem('catalogo-view-mode', viewMode);
  }, [viewMode]);

  const [hideOwned, setHideOwned] = useState(false);
  const { data: ownedIds = [] } = useQuery({
    queryKey: ['catalogo-owned', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('biblioteca_usuario').select('product_id').eq('user_id', user!.id);
      return (data || []).map(r => r.product_id as string);
    },
    staleTime: 60_000,
  });
  useQuery({
    queryKey: ['catalogo-hide-owned', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('hide_owned_games').eq('id', user!.id).maybeSingle();
      setHideOwned(!!data?.hide_owned_games);
      return data?.hide_owned_games ?? false;
    },
    staleTime: 60_000,
  });
  const { data: hideAdult = false } = useQuery({
    queryKey: ['catalogo-hide-adult', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('hide_adult_content').eq('id', user!.id).maybeSingle();
      return !!(data as any)?.hide_adult_content;
    },
    staleTime: 60_000,
  });
  const { data: adultIds = [] } = useQuery({
    queryKey: ['catalogo-adult-ids'],
    enabled: hideAdult,
    queryFn: async () => {
      const { data } = await supabase.from('produtos').select('id').eq('classificacao_indicativa', '18' as any);
      return (data || []).map(r => r.id as string);
    },
    staleTime: 5 * 60_000,
  });

  const [savingHideOwned, setSavingHideOwned] = useState(false);
  const toggleHideOwned = async () => {
    const next = !hideOwned;
    setHideOwned(next);
    if (user) {
      setSavingHideOwned(true);
      await dbWrite(supabase.from('profiles').update({ hide_owned_games: next }).eq('id', user.id));
      setSavingHideOwned(false);
    }
  };
  const { data: dbCategories = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const { data } = await supabase.from('categorias').select('name').order('name');
      return data ? ['Todos', ...data.map(c => c.name)] : ['Todos'];
    },
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (category !== 'Todos') p.set('cat', category);
    if (selectedPlatforms.length) p.set('platforms', selectedPlatforms.join(','));
    if (priceMin !== PRICE_MIN) p.set('pmin', String(priceMin));
    if (priceMax !== PRICE_MAX) p.set('pmax', String(priceMax));
    if (sortBy !== 'recent') p.set('sort', sortBy);
    if (minRating > 0) p.set('minRating', String(minRating));
    if (yearFilter > 0) p.set('year', String(yearFilter));
    setSearchParams(p, { replace: true });
  }, [query, category, selectedPlatforms, priceMin, priceMax, sortBy, minRating, yearFilter, setSearchParams]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [query, category, selectedPlatforms, priceMin, priceMax, sortBy, minRating, yearFilter, hideOwned]);

  const categoryOptions = dbCategories.length > 1 ? dbCategories : ["Todos"];
  const platformOptions = platforms.filter(p => p !== 'Todos');

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const activeFilters =
    (category !== 'Todos' ? 1 : 0) +
    selectedPlatforms.length +
    (priceMin !== PRICE_MIN || priceMax !== PRICE_MAX ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (yearFilter > 0 ? 1 : 0);

  const clearFilters = () => {
    setCategory('Todos');
    setSelectedPlatforms([]);
    setPriceMin(PRICE_MIN);
    setPriceMax(PRICE_MAX);
    setMinRating(0);
    setYearFilter(0);
  };

  const debouncedQuery = useDebounce(query, 200);
  
  // GAP-006: Diferenciar estados vazios
  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let result = games.filter((g) => {
      const matchQuery = !q || g.title.toLowerCase().includes(q) || g.tags.some((t) => t.toLowerCase().includes(q));
      const matchCat = category === "Todos" || g.category === category;
      const matchPlat = selectedPlatforms.length === 0 || selectedPlatforms.some(p => g.platform.includes(p));
      const matchPrice = g.price >= priceMin && g.price <= priceMax;
      const matchOwned = !hideOwned || !ownedIds.includes(g.id);
      const matchAdult = !hideAdult || !adultIds.includes(g.id);
      // GAP-105, GAP-436: Filtro por avaliação mínima
      const matchRating = minRating === 0 || (g.rating || 0) >= minRating;
      // GAP-106, GAP-437: Filtro por ano
      const matchYear = yearFilter === 0 || (g.releaseDate && new Date(g.releaseDate).getFullYear() === yearFilter);
      return matchQuery && matchCat && matchPlat && matchPrice && matchOwned && matchAdult && matchRating && matchYear;
    });
    switch (sortBy) {
      case "recent":
        result.sort((a: any, b: any) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime());
        break;
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "discount":
        result.sort((a, b) => b.discount - a.discount);
        break;
      case "rating":
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }
    return result;
  }, [games, debouncedQuery, category, selectedPlatforms, priceMin, priceMax, sortBy, hideOwned, ownedIds, hideAdult, adultIds, minRating, yearFilter]);

  // GAP-004, GAP-104, GAP-435: Paginação
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // GAP-441: Recomendados para você (baseado em gêneros favoritos)
  const { data: recommendations = [] } = useQuery({
    queryKey: ['catalogo-recommendations', user?.id],
    enabled: !!user && games.length > 0,
    queryFn: async () => {
      // Buscar gêneros favoritos do usuário
      const { data: profile } = await supabase.from('profiles').select('favorite_genres').eq('id', user!.id).maybeSingle();
      const genres = (profile as any)?.favorite_genres || [];
      if (genres.length === 0) return [];
      // Buscar jogos dos mesmos gêneros que o usuário não possui
      const { data } = await supabase
        .from('produtos')
        .select('*')
        .in('category', genres)
        .not('id', 'in', `(${ownedIds.join(',') || '""'})`)
        .limit(6);
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const hasActiveFilters = activeFilters > 0 || debouncedQuery.trim().length > 0;

  // GAP-006: Mensagens diferentes para estados vazios
  const isEmpty = filtered.length === 0;
  const isFilterEmpty = isEmpty && hasActiveFilters;
  const isCatalogEmpty = isEmpty && !hasActiveFilters;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">Catálogo de jogos</h1>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, tag ou gênero..."
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <SelectSimples
            value={category}
            onChange={setCategory}
            label="Filtrar por categoria"
            options={categoryOptions.map((c) => ({ value: c, label: c }))}
          />
          <SelectSimples
            value={sortBy}
            onChange={setSortBy}
            label="Ordenar resultados"
            options={[
              { value: 'recent', label: 'Mais recentes' },
              { value: 'price-asc', label: 'Menor preço' },
              { value: 'price-desc', label: 'Maior preço' },
              { value: 'discount', label: 'Maior desconto' },
              { value: 'rating', label: 'Melhor avaliação' },
            ]}
          />
          {/* GAP-107, GAP-438: Toggle grid/lista */}
          <ViewToggle view={viewMode} onChange={setViewMode} />
        </div>

        {/* Plataformas */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Plataformas</p>
          <div className="flex flex-wrap gap-2">
            {platformOptions.map(p => {
              const active = selectedPlatforms.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)} aria-pressed={selectedPlatforms.includes(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:border-primary/50'}`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Faixa de preço */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-muted-foreground">Preço</p>
            <p className="text-xs text-muted-foreground">R$ {priceMin} — R$ {priceMax}{priceMax >= PRICE_MAX ? '+' : ''}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              type="range" min={PRICE_MIN} max={PRICE_MAX} step={10} value={priceMin}
              onChange={e => setPriceMin(Math.min(Number(e.target.value), priceMax))}
              className="flex-1 accent-primary"
            />
            <input
              type="range" min={PRICE_MIN} max={PRICE_MAX} step={10} value={priceMax}
              onChange={e => setPriceMax(Math.max(Number(e.target.value), priceMin))}
              className="flex-1 accent-primary"
            />
          </div>
        </div>

        {/* GAP-105, GAP-436: Filtro por avaliação mínima */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-400" />
            <span className="text-xs text-muted-foreground">Avaliação mínima:</span>
            <StarFilter value={minRating} onChange={setMinRating} />
          </div>

          {/* GAP-106, GAP-437: Filtro por ano */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <YearFilter value={yearFilter} onChange={setYearFilter} />
          </div>
        </div>

        {user && (
          <button
            onClick={toggleHideOwned}
            disabled={savingHideOwned} aria-pressed={hideOwned}
            className={`self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors disabled:opacity-50 ${hideOwned ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-foreground hover:border-primary/50'}`}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Ocultar jogos que já tenho
          </button>
        )}

        {activeFilters > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{activeFilters} filtro(s) ativo(s)</span>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-card text-xs font-semibold hover:border-primary/60"
            >
              <X className="h-3 w-3" /> Limpar filtros
            </button>
          </div>
        )}
      </div>

      {isError ? (
        <ErroCarregamento
          titulo="Não foi possível carregar o catálogo"
          descricao="Verifique sua conexão e tente novamente."
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : isLoading ? (
        viewMode === 'grid' ? (
          <GameCardGridSkeleton count={12} />
        ) : (
          <GameCardListSkeleton count={12} />
        )
      ) : (
        <>
          {/* GAP-441: Recomendados para você */}
          {user && recommendations.length > 0 && !hasActiveFilters && (
            <section className="mb-8">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" /> Recomendados para você
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {recommendations.map((game, i) => (
                  <GameCard key={game.id} game={game} index={i} />
                ))}
              </div>
            </section>
          )}

          {!debouncedQuery && activeFilters === 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Bundles
              </h2>
              <div className="grid grid-cols-1 sm:grid-flow-col sm:auto-cols-fr gap-4 w-full">
                <BundleStoreGrid limit={4} />
              </div>
            </section>
          )}

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {filtered.length} jogos encontrados
              {page > 1 && ` — Página ${page} de ${totalPages}`}
            </p>
          </div>

          {isCatalogEmpty && (
            <EstadoVazio
              icone={Package}
              titulo="Nenhum jogo disponível"
              descricao="Volte em breve, novos jogos serão adicionados em breve."
            />
          )}

          {isFilterEmpty && (
            <EstadoVazio
              icone={SearchX}
              titulo="Nenhum jogo encontrado com esses filtros"
              descricao="Tente ajustar os filtros ou buscar por outro termo."
              acao={{ label: 'Limpar filtros', onClick: clearFilters }}
            />
          )}

          {!isEmpty && (
            <>
              <div className={viewMode === 'grid' 
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                : "flex flex-col gap-3"
              }>
                {paginatedItems.map((game, i) => (
                  <GameCard key={game.id} game={game} index={i} />
                ))}
              </div>

              {/* GAP-004, GAP-104, GAP-435: Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded border border-border bg-card text-sm disabled:opacity-50 hover:bg-secondary transition"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded border border-border bg-card text-sm disabled:opacity-50 hover:bg-secondary transition"
                  >
                    Próxima
        </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* GAP-007: Última atualização */}
      <LastUpdated time={new Date()} />
    </div>
  );
}