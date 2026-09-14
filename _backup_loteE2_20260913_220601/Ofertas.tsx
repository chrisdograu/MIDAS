import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProdutos } from '@/hooks/useProdutos';
import GameCard from '@/components/GameCard';
import { Zap, SearchX, Filter, Share2, Clock, Loader2 } from 'lucide-react';
import { GameCardGridSkeleton } from '@/components/skeletons';
import EstadoVazio from '@/components/EstadoVazio';
import SelectSimples from '@/components/SelectSimples';
import { toast } from 'sonner';

export default function Ofertas() {
  const { data: games = [], isLoading } = useProdutos();
  const [minDiscount, setMinDiscount] = useState(0);
  const [sortBy, setSortBy] = useState<'discount' | 'price'>('discount');
  const [platformFilter, setPlatformFilter] = useState<string>('Todas');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [sharing, setSharing] = useState(false);
  
  // GAP-518: Paginação
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  // Extrair plataformas e categorias disponíveis
  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    games.forEach(g => g.platform?.forEach((p: string) => platforms.add(p)));
    return ['Todas', ...Array.from(platforms).sort()];
  }, [games]);

  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    games.forEach(g => { if (g.category) categories.add(g.category); });
    return ['Todas', ...Array.from(categories).sort()];
  }, [games]);

  const deals = useMemo(() => {
    let result = games.filter(g => g.discount > 0 && g.discount >= minDiscount);
    
    // GAP-517: Filtro por plataforma
    if (platformFilter !== 'Todas') {
      result = result.filter(g => g.platform?.includes(platformFilter));
    }
    
    // GAP-517: Filtro por categoria
    if (categoryFilter !== 'Todas') {
      result = result.filter(g => g.category === categoryFilter);
    }
    
    // GAP-519: Ordenação
    if (sortBy === 'discount') {
      result.sort((a, b) => b.discount - a.discount);
    } else {
      result.sort((a, b) => a.price - b.price);
    }
    
    return result;
  }, [games, minDiscount, platformFilter, categoryFilter, sortBy]);

  // GAP-518: Paginação
  const totalPages = Math.ceil(deals.length / ITEMS_PER_PAGE);
  const paginatedDeals = deals.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Reset page when filters change
  const resetPage = () => setPage(1);

  // GAP-521: Compartilhar
  const handleShare = async () => {
    setSharing(true);
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Ofertas Especiais - MIDIAS',
          text: `Confira as melhores ofertas do momento na MIDIAS! ${deals.length} jogos com desconto.`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      }
    } catch {
      // Usuário cancelou
    } finally {
      setSharing(false);
    }
  };

  if (isLoading) return <div className="container mx-auto px-4 py-8"><GameCardGridSkeleton count={12} /></div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-price" />
          <h1 className="text-2xl font-bold text-foreground">Ofertas Especiais</h1>
        </div>
        {/* GAP-521: Compartilhar */}
        <button
          onClick={handleShare}
          disabled={sharing || deals.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          Compartilhar
        </button>
      </div>
      <p className="text-muted-foreground mb-6">Os melhores descontos em jogos digitais. Aproveite antes que acabe!</p>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Filtros:</span>
        </div>
        
        <SelectSimples
          value={String(minDiscount)}
          onChange={(v) => { setMinDiscount(Number(v)); resetPage(); }}
          label="Desconto mínimo"
          size="sm"
          options={[
            { value: '0', label: 'Todos' },
            { value: '10', label: '≥ 10%' },
            { value: '20', label: '≥ 20%' },
            { value: '30', label: '≥ 30%' },
            { value: '50', label: '≥ 50%' },
          ]}
          className="w-32"
        />
        
        {/* GAP-517: Filtro por plataforma */}
        <SelectSimples
          value={platformFilter}
          onChange={(v) => { setPlatformFilter(v); resetPage(); }}
          label="Plataforma"
          size="sm"
          options={availablePlatforms.map(p => ({ value: p, label: p }))}
          className="w-36"
        />
        
        {/* GAP-517: Filtro por categoria */}
        <SelectSimples
          value={categoryFilter}
          onChange={(v) => { setCategoryFilter(v); resetPage(); }}
          label="Categoria"
          size="sm"
          options={availableCategories.map(c => ({ value: c, label: c }))}
          className="w-36"
        />
        
        {/* GAP-519: Ordenação */}
        <SelectSimples
          value={sortBy}
          onChange={(v) => { setSortBy(v as 'discount' | 'price'); resetPage(); }}
          label="Ordenar por"
          size="sm"
          options={[
            { value: 'discount', label: 'Maior desconto' },
            { value: 'price', label: 'Menor preço' },
          ]}
          className="w-36"
        />
      </div>

      {deals.length === 0 ? (
        <EstadoVazio
          icone={SearchX}
          titulo="Sem ofertas com esses filtros"
          descricao="Tente ajustar os filtros ou veja o catálogo completo."
          acao={{ label: 'Ver catálogo completo', to: '/catalogo' }}
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{deals.length} ofertas encontradas</p>
            {totalPages > 1 && (
              <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
            )}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {paginatedDeals.map((game) => {
              // GAP-520: Badge "Últimas horas" (simulado)
              const isExpiringSoon = (game as any).expiring_soon === true;
              
              return (
                <div key={game.id} className="relative">
                  <GameCard game={game} />
                  {isExpiringSoon && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> Últimas horas
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* GAP-518: Paginação */}
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
    </div>
  );
}