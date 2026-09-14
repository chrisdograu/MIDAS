import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package, List, Grid3x3, ChevronDown, Loader2 } from 'lucide-react';
import { GameCardSkeleton } from '@/components/skeletons';
import { formatCurrency } from '@/lib/format';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

// GAP-BS03: Modos de visualização
type ViewMode = 'grid' | 'list';

// GAP-BS04: Filtros e ordenação
type SortBy = 'price-asc' | 'price-desc' | 'name' | 'popularity';

interface Bundle {
  id: string; 
  title: string; 
  price: number; 
  image_url: string | null;
  items: { product_id: string; title: string; image_url: string | null; price: number }[];
  total_original: number;
  views?: number;
}

async function fetchBundles(
  limit: number, 
  offset: number = 0,
  sortBy: SortBy = 'price-asc'
): Promise<{ bundles: Bundle[]; total: number }> {
  // GAP-BS04: Ordenação
  const orderMap: Record<SortBy, { column: string; ascending: boolean }> = {
    'price-asc': { column: 'price', ascending: true },
    'price-desc': { column: 'price', ascending: false },
    'name': { column: 'title', ascending: true },
    'popularity': { column: 'views', ascending: false },
  };
  
  const order = orderMap[sortBy] || orderMap['price-asc'];
  
  // Buscar bundles com paginação
  const { data: bds, count, error } = await supabase
    .from('bundles' as any)
    .select('id, title, price, image_url, views', { count: 'exact' })
    .eq('is_active', true)
    .order(order.column, { ascending: order.ascending })
    .range(offset, offset + limit - 1);
    
  if (error) throw error;
  const bundlesRaw = (bds as any[]) || [];
  if (!bundlesRaw.length) return { bundles: [], total: count || 0 };

  const ids = bundlesRaw.map(b => b.id);
  const { data: bis, error: biErr } = await supabase
    .from('bundle_items' as any)
    .select('bundle_id, product_id')
    .in('bundle_id', ids);
  if (biErr) throw biErr;

  const pids = [...new Set(((bis as any[]) || []).map(x => x.product_id))];
  const { data: prods, error: pErr } = pids.length
    ? await supabase.from('produtos').select('id, title, image_url, price').in('id', pids)
    : { data: [] as any[], error: null };
  if (pErr) throw pErr;

  const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));
  const byBundle = new Map<string, any[]>();
  ((bis as any[]) || []).forEach((row: any) => {
    const p = prodMap.get(row.product_id);
    if (!p) return;
    const arr = byBundle.get(row.bundle_id) || [];
    arr.push({ product_id: row.product_id, title: p.title, image_url: p.image_url, price: Number(p.price) });
    byBundle.set(row.bundle_id, arr);
  });

  return {
    bundles: bundlesRaw.map((b: any) => ({
      id: b.id, 
      title: b.title, 
      price: Number(b.price), 
      image_url: b.image_url,
      items: byBundle.get(b.id) || [], 
      total_original: (byBundle.get(b.id) || []).reduce((s, i) => s + i.price, 0),
      views: b.views || 0,
    })),
    total: count || 0,
  };
}

interface BundleStoreGridProps {
  limit?: number;
  /** GAP-BS01: Modo carrossel */
  carousel?: boolean;
  /** GAP-BS02: Scroll infinito */
  infiniteScroll?: boolean;
  /** GAP-BS03: Modo de visualização */
  viewMode?: ViewMode;
  /** GAP-BS04: Ordenação */
  sortBy?: SortBy;
  /** GAP-BS04: Filtro por categoria */
  filterBy?: string[];
  /** GAP-BS04: Filtro por preço máximo */
  maxPrice?: number;
}

export default function BundleStoreGrid({ 
  limit = 8,
  carousel = false,
  infiniteScroll = false,
  viewMode: initialViewMode = 'grid',
  sortBy: initialSortBy = 'price-asc',
  filterBy = [],
  maxPrice,
}: BundleStoreGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [sortBy, setSortBy] = useState<SortBy>(initialSortBy);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // GAP-BS02: Infinite scroll query
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage,
    isLoading,
    isError 
  } = useInfiniteQuery({
    queryKey: ['bundles', 'store-grid', limit, sortBy, filterBy, maxPrice],
    queryFn: ({ pageParam = 0 }) => fetchBundles(limit, pageParam, sortBy),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, page) => acc + page.bundles.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
    staleTime: 60_000,
    enabled: infiniteScroll,
  });

  // GAP-BS01: Carrossel
  const [scrollIndex, setScrollIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const allBundles = infiniteScroll 
    ? data?.pages.flatMap(p => p.bundles) || []
    : [];

  // GAP-BS04: Filtros client-side
  const filteredBundles = useCallback((bundles: Bundle[]) => {
    let result = bundles;
    if (maxPrice) {
      result = result.filter(b => b.price <= maxPrice);
    }
    if (filterBy.length > 0) {
      result = result.filter(b => 
        b.items.some(item => filterBy.includes(item.product_id))
      );
    }
    return result;
  }, [maxPrice, filterBy]);

  // GAP-BS02: Observer para scroll infinito
  useEffect(() => {
    if (!infiniteScroll || !loadMoreRef.current || !hasNextPage) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: '100px' }
    );
    
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [infiniteScroll, hasNextPage, fetchNextPage]);

  // GAP-BS01: Navegação do carrossel
  const handleCarouselNext = () => {
    if (!carouselRef.current) return;
    const items = carouselRef.current.children;
    if (scrollIndex + 4 < items.length) {
      setScrollIndex(scrollIndex + 4);
      items[scrollIndex + 4]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleCarouselPrev = () => {
    if (!carouselRef.current) return;
    if (scrollIndex > 0) {
      setScrollIndex(Math.max(0, scrollIndex - 4));
      carouselRef.current.children[Math.max(0, scrollIndex - 4)]?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  };

  // GAP-BS03: Renderizar item
  const renderBundleItem = (b: Bundle) => {
    const saving = b.total_original > 0 ? Math.round((1 - b.price / b.total_original) * 100) : 0;
    const isListView = viewMode === 'list';

    return (
      <Link
        key={b.id}
        to={`/bundle/${b.id}`}
        className={cn(
          "group bg-card border border-border hover:border-primary/60 rounded-lg overflow-hidden transition-colors",
          isListView ? "flex items-center gap-4 p-3" : "flex flex-col"
        )}
      >
        <div className={cn(
          "relative overflow-hidden bg-secondary",
          isListView ? "w-24 h-24 shrink-0 rounded-lg" : "aspect-video"
        )}>
          {b.image_url ? (
            <img 
              src={b.image_url} 
              alt={b.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              loading="lazy" 
            />
          ) : (
            <div className={cn(
              "grid grid-cols-2 grid-rows-2 w-full h-full",
              isListView && "grid-cols-2 grid-rows-2"
            )}>
              {b.items.slice(0, 4).map((it, i) => (
                it.image_url ? 
                  <img key={i} src={it.image_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : 
                  <div key={i} className="bg-muted" />
              ))}
            </div>
          )}
          <span className="absolute top-2 left-2 text-xs font-bold bg-gradient-to-r from-primary to-accent text-primary-foreground px-2 py-0.5 rounded flex items-center gap-1">
            <Package className="h-3 w-3" /> BUNDLE
          </span>
          {saving > 0 && (
            <span className="absolute top-2 right-2 text-xs font-bold bg-success text-success-foreground px-2 py-0.5 rounded">
              -{saving}%
            </span>
          )}
        </div>
        
        <div className={cn(
          "flex-1",
          isListView ? "min-w-0" : "p-3 flex flex-col"
        )}>
          <h3 className={cn(
            "font-semibold line-clamp-1",
            isListView ? "text-sm" : "text-sm"
          )}>
            {b.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {b.items.length} {b.items.length === 1 ? 'jogo incluso' : 'jogos inclusos'}
          </p>
          <div className={cn(
            "mt-auto flex items-baseline gap-2",
            isListView ? "mt-1" : "mt-2"
          )}>
            {b.total_original > b.price && (
              <span className="text-xs text-muted-foreground line-through">{formatCurrency(b.total_original)}</span>
            )}
            <span className={cn(
              "font-bold text-primary",
              isListView ? "text-sm" : "text-base"
            )}>
              {formatCurrency(b.price)}
            </span>
          </div>
        </div>
      </Link>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div 
        className={cn(
          viewMode === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" 
            : "space-y-3"
        )}
        aria-busy="true"
        aria-label="Carregando bundles"
      >
        {Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) return null;

  const displayBundles = infiniteScroll 
    ? filteredBundles(allBundles)
    : filteredBundles([]);

  if (!displayBundles.length) return null;

  // GAP-BS01: Modo carrossel
  if (carousel) {
    return (
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Bundles em Destaque</h3>
          <div className="flex gap-1">
            <button
              onClick={handleCarouselPrev}
              className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors disabled:opacity-50"
              disabled={scrollIndex === 0}
            >
              ←
            </button>
            <button
              onClick={handleCarouselNext}
              className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors disabled:opacity-50"
              disabled={scrollIndex + 4 >= displayBundles.length}
            >
              →
            </button>
          </div>
        </div>
        <div 
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory"
        >
          {displayBundles.slice(0, 8).map((b, i) => (
            <div key={b.id} className="min-w-[200px] max-w-[200px] snap-start">
              {renderBundleItem(b)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // GAP-BS03: Toggle de visualização
  const viewToggle = (
    <div className="flex items-center gap-1 mb-4">
      <button
        onClick={() => setViewMode('grid')}
        className={cn(
          "p-2 rounded-lg transition-colors",
          viewMode === 'grid' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Grid3x3 className="h-4 w-4" />
      </button>
      <button
        onClick={() => setViewMode('list')}
        className={cn(
          "p-2 rounded-lg transition-colors",
          viewMode === 'list' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div>
      {viewToggle}
      
      <div className={cn(
        viewMode === 'grid' 
          ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" 
          : "space-y-3"
      )}>
        {displayBundles.map(renderBundleItem)}
      </div>

      {/* GAP-BS02: Infinite scroll trigger */}
      {infiniteScroll && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
          {!hasNextPage && displayBundles.length > 0 && (
            <p className="text-sm text-muted-foreground">Todos os bundles carregados</p>
          )}
        </div>
      )}
    </div>
  );
}