import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFavoritos } from '@/hooks/useFavoritos';
import { supabase } from '@/integrations/supabase/client';
import { mapProdutoToGame, Game } from '@/lib/gameData';
import GameCard from '@/components/GameCard';
import { Heart, Loader2, ArrowLeft, BellRing, Check, Share2, Filter, ArrowUpDown, AlertTriangle, TrendingDown, CheckCircle2 } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import BuscaInput from '@/components/BuscaInput';
import ErroCarregamento from '@/components/ErroCarregamento';
import { GameCardGridSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/format';

type SortKey = 'recent' | 'title' | 'price';
type FilterKey = 'all' | 'on_sale' | 'target_reached';

// GAP-130, GAP-482: Função para verificar quedas de preço
async function checkPriceDrops(favorites: string[], currentPrices: Record<string, number>) {
  const { data } = await supabase
    .from('favoritos')
    .select('product_id, target_price, price_alert_sent')
    .in('product_id', favorites)
    .not('target_price', 'is', null);
  
  const drops: { productId: string; currentPrice: number; targetPrice: number }[] = [];
  (data || []).forEach((row: any) => {
    const current = currentPrices[row.product_id];
    if (current && current <= row.target_price && !row.price_alert_sent) {
      drops.push({ productId: row.product_id, currentPrice: current, targetPrice: row.target_price });
    }
  });
  return drops;
}

// GAP-133, GAP-485: Componente de comparação de preço
function PriceComparison({ currentPrice, targetPrice }: { currentPrice: number; targetPrice: number | null }) {
  if (!targetPrice) return null;
  
  const isTargetReached = currentPrice <= targetPrice;
  const progress = Math.min(100, Math.round(((currentPrice - targetPrice) / targetPrice) * 100));
  
  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Meta: {formatCurrency(targetPrice)}</span>
        <span className={isTargetReached ? 'text-success font-semibold' : 'text-muted-foreground'}>
          {isTargetReached ? '✅ Meta atingida!' : `${Math.abs(progress)}% acima`}
        </span>
      </div>
      <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 rounded-full ${isTargetReached ? 'bg-success' : 'bg-primary'}`}
          style={{ width: isTargetReached ? '100%' : `${Math.max(0, 100 - progress)}%` }}
        />
      </div>
    </div>
  );
}

export default function Favoritos() {
  const { favoritos, loading } = useFavoritos();
  const { user } = useAuth();
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [favGames, setFavGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [busca, setBusca] = useState('');
  
  // GAP-131, GAP-483: Ordenação
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  
  // GAP-132, GAP-484: Filtro "em oferta agora"
  const [filterOnSale, setFilterOnSale] = useState(false);
  
  // GAP-133, GAP-485: Estado para preços atuais
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});

  // GAP-130, GAP-482: Verificar quedas de preço
  useEffect(() => {
    if (favGames.length === 0) return;
    
    const prices: Record<string, number> = {};
    favGames.forEach(g => { prices[g.id] = g.price; });
    setCurrentPrices(prices);
    
    // Verificar drops a cada 30 segundos (em produção seria um job)
    const interval = setInterval(async () => {
      const drops = await checkPriceDrops(favoritos, prices);
      for (const drop of drops) {
        toast.info(`🎉 ${favGames.find(g => g.id === drop.productId)?.title} atingiu seu preço-alvo!`, {
          duration: 10000,
          action: {
            label: 'Ver',
            onClick: () => window.location.href = `/jogo/${drop.productId}`
          }
        });
        // Marcar como já alertado pra não repetir
        await supabase
          .from('favoritos')
          .update({ price_alert_sent: true })
          .eq('product_id', drop.productId);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [favGames, favoritos]);

  useEffect(() => {
    if (loading) return;
    if (!favoritos.length) { setFavGames([]); return; }
    let cancelled = false;
    setLoadingGames(true);
    setLoadError(false);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .in('id', favoritos)
          .eq('is_active', true);
        if (error) throw error;
        if (cancelled) return;
        setFavGames((data || []).map(mapProdutoToGame));
        const { data: rows } = await supabase
          .from('favoritos')
          .select('product_id, target_price, price_alert_sent')
          .in('product_id', favoritos);
        if (!cancelled) {
          const map: Record<string, string> = {};
          (rows || []).forEach((r: any) => {
            if (r.target_price != null) map[r.product_id] = String(r.target_price);
          });
          setTargets(map);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoadingGames(false);
      }
    })();
    return () => { cancelled = true; };
  }, [favoritos, loading, reloadTick]);

  // GAP-131, GAP-483: Função de ordenação
  const sortedGames = useMemo(() => {
    let result = [...favGames];
    switch (sortBy) {
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'price':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'recent':
      default:
        // Manter ordem original (mais recentes primeiro)
        break;
    }
    return result;
  }, [favGames, sortBy]);

  // GAP-132, GAP-484: Filtrar por oferta
  const filteredGames = useMemo(() => {
    let result = sortedGames;
    if (filterOnSale) {
      result = result.filter(g => g.discount > 0);
    }
    return result;
  }, [sortedGames, filterOnSale]);

  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? filteredGames.filter(g => g.title.toLowerCase().includes(termo)) : filteredGames;

  const saveTarget = async (productId: string) => {
    if (!user) return;
    const raw = (targets[productId] ?? '').replace(',', '.').trim();
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      toast.error('Informe um preço-alvo válido.');
      return;
    }
    setSavingId(productId);
    const { error } = await supabase
      .from('favoritos')
      .update({ target_price: value, price_alert_sent: false })
      .eq('user_id', user.id)
      .eq('product_id', productId);
    setSavingId(null);
    if (error) toast.error('Não foi possível salvar o preço-alvo.');
    else toast.success(value === null ? 'Alerta de preço removido.' : `Avisaremos quando cair para ${formatCurrency(value)}.`);
  };

  // GAP-134, GAP-486: Compartilhar lista
  const shareList = async () => {
    if (!user || favGames.length === 0) return;
    try {
      const shareData = {
        title: 'Minha lista de favoritos - MIDIAS',
        text: `Confira minha lista de jogos favoritos na MIDIAS! (${favGames.length} jogos)`,
        url: window.location.href,
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast.success('Link copiado para a área de transferência!');
      }
    } catch {
      // Usuário cancelou ou navegador não suporta
    }
  };

  if (loading || loadingGames) {
    return (
      <div className="container mx-auto px-4 py-8">
        <GameCardGridSkeleton count={10} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" /> Meus favoritos
          {favGames.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({favGames.length})</span>
          )}
        </h1>
        
        {/* GAP-134, GAP-486: Botão de compartilhar */}
        {favGames.length > 0 && (
          <button
            onClick={shareList}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:border-primary/50 transition-colors"
          >
            <Share2 className="h-4 w-4" /> Compartilhar lista
          </button>
        )}
      </div>

      {favGames.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          <BuscaInput 
            value={busca} 
            onChange={setBusca} 
            placeholder="Buscar nos seus favoritos..." 
            className="flex-1 min-w-[200px]"
          />
          
          {/* GAP-131, GAP-483: Ordenação */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="recent">Mais recentes</option>
            <option value="title">Título (A-Z)</option>
            <option value="price">Menor preço</option>
          </select>
          
          {/* GAP-132, GAP-484: Filtro "em oferta" */}
          <button
            onClick={() => setFilterOnSale(!filterOnSale)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              filterOnSale 
                ? 'border-primary bg-primary/10 text-primary' 
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Filter className="h-4 w-4" />
            {filterOnSale ? 'Mostrando ofertas' : 'Apenas ofertas'}
            {favGames.filter(g => g.discount > 0).length > 0 && (
              <span className="text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
                {favGames.filter(g => g.discount > 0).length}
              </span>
            )}
          </button>
        </div>
      )}

      {loadError && (
        <ErroCarregamento
          titulo="Não foi possível carregar seus favoritos"
          onRetry={() => setReloadTick(t => t + 1)}
        />
      )}

      {!loadError && favGames.length > 0 && visiveis.length === 0 ? (
        <EstadoVazio
          icone={Heart}
          titulo="Nenhum favorito encontrado"
          descricao={`Nada corresponde a "${busca.trim()}". Tente outro termo.`}
        />
      ) : !loadError && favGames.length === 0 ? (
        <EstadoVazio
          icone={Heart}
          titulo="Nenhum favorito ainda"
          descricao="Salve os jogos que você quer acompanhar para vê-los aqui."
          acao={{ label: 'Explorar catálogo', to: '/catalogo' }}
        />
      ) : !loadError && (
        <>
          {/* GAP-132, GAP-484: Indicador de filtro ativo */}
          {filterOnSale && visiveis.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum dos seus favoritos está em oferta no momento.</p>
              <button 
                onClick={() => setFilterOnSale(false)}
                className="text-primary hover:underline text-sm mt-2"
              >
                Mostrar todos os favoritos
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {visiveis.map((game) => {
              const targetPrice = targets[game.id] ? Number(targets[game.id]) : null;
              const isTargetReached = targetPrice && game.price <= targetPrice;
              
              return (
                <div key={game.id} className="space-y-2">
                  <GameCard game={game} />
                  
                  {/* GAP-130, GAP-482: Badge de alerta de preço */}
                  {isTargetReached && (
                    <div className="flex items-center gap-1 text-[10px] text-success bg-success/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      Meta atingida!
                    </div>
                  )}
                  
                  <div className="rounded-lg border border-border bg-card px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <BellRing className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Preço-alvo"
                        aria-label={`Preço-alvo para ${game.title}`}
                        value={targets[game.id] ?? ''}
                        onChange={e => setTargets(prev => ({ ...prev, [game.id]: e.target.value }))}
                        onBlur={() => saveTarget(game.id)}
                        disabled={savingId === game.id}
                        className="w-full min-w-0 bg-transparent text-xs text-foreground outline-none disabled:opacity-60"
                      />
                      {savingId === game.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        : <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>
                  
                  {/* GAP-133, GAP-485: Comparação de preço */}
                  {targetPrice && (
                    <PriceComparison 
                      currentPrice={game.price} 
                      targetPrice={targetPrice} 
                    />
                  )}
                  
                  {/* GAP-132, GAP-484: Badge de oferta */}
                  {game.discount > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      <TrendingDown className="h-3 w-3" />
                      {game.discount}% OFF
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}