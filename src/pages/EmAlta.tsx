import { useState, useMemo } from 'react';
import { Flame, AlertTriangle, Share2, Filter, Monitor, Smartphone, Trophy, Calendar, Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRadarDelta } from '@/hooks/useRadarDelta';
import { GameCardGridSkeleton } from '@/components/skeletons';
import EstadoVazio from '@/components/EstadoVazio';
import { toast } from 'sonner';
import SelectSimples from '@/components/SelectSimples';

// GAP-141: Tipos de janela temporal
type TimeWindow = '24h' | '7d' | '30d';

// GAP-143, GAP-470: Plataformas
const PLATFORMS = ['Todas', 'PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile'];

// GAP-145: Categorias disponíveis (serão extraídas dos dados)
const CATEGORIES = ['Todos', 'Ação', 'Aventura', 'RPG', 'Estratégia', 'Indie', 'Terror'];

/**
 * "Em Alta" agora usa a MESMA fórmula do Radar Delta da Home
 * (views_24h + posts_72h + reviews_7d ponderados), garantindo
 * paridade semântica entre Órbita e Em Alta.
 */
export default function EmAlta() {
  // GAP-141: Janela temporal
  const [window, setWindow] = useState<TimeWindow>('24h');
  // GAP-143, GAP-470: Filtro por plataforma
  const [platformFilter, setPlatformFilter] = useState<string>('Todas');
  // GAP-145: Filtro por categoria
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  
  // GAP-144: Estado de compartilhamento
  const [sharing, setSharing] = useState(false);

  // Mapear janela para o valor da API
  const windowMap: Record<TimeWindow, number> = {
    '24h': 24,
    '7d': 168,
    '30d': 720,
  };

  const { data: items = [], isLoading, isError } = useRadarDelta(windowMap[window]);

  // GAP-141: Tabs de janela temporal
  const windowTabs: { key: TimeWindow; label: string }[] = [
    { key: '24h', label: 'Últimas 24h' },
    { key: '7d', label: 'Últimos 7 dias' },
    { key: '30d', label: 'Últimos 30 dias' },
  ];

  // GAP-144: Compartilhar ranking
  const handleShare = async () => {
    setSharing(true);
    const url = globalThis.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Jogos em Alta - MIDIAS',
          text: `Confira os jogos mais quentes do momento no MIDIAS!`,
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

  // Aplicar filtros (memoizado)
  const filteredItems = useMemo(() => items.filter(item => {
    if (platformFilter !== 'Todas' && !item.platform?.includes(platformFilter)) {
      return false;
    }
    if (categoryFilter !== 'Todos' && item.category !== categoryFilter) {
      return false;
    }
    return true;
  }), [items, platformFilter, categoryFilter]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Flame className="h-7 w-7 text-warning" />
          <div>
            <h1 className="text-3xl font-display font-bold">Em Alta</h1>
            <p className="text-muted-foreground text-sm">
              Ranking geral da comunidade — mesma fórmula ponderada do Radar da Home.
            </p>
          </div>
        </div>
        
        {/* GAP-144: Botão de compartilhar */}
        <button
          onClick={handleShare}
          disabled={sharing || items.length === 0} aria-label="Compartilhar ranking de jogos em alta"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          Compartilhar
        </button>
      </div>

      {/* GAP-141: Tabs de janela temporal */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {windowTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setWindow(tab.key)} aria-pressed={window === tab.key} aria-label={`Ver tendências de ${tab.label}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              window === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* GAP-143, GAP-470: Filtro por plataforma */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Filtrar:</span>
        <SelectSimples
          value={platformFilter}
          onChange={setPlatformFilter}
          label="Plataforma"
          size="sm"
          options={PLATFORMS.map(p => ({ value: p, label: p }))}
          className="w-40"
        />
        
        {/* GAP-145: Filtro por categoria */}
        <SelectSimples
          value={categoryFilter}
          onChange={setCategoryFilter}
          label="Categoria"
          size="sm"
          options={CATEGORIES.map(c => ({ value: c, label: c }))}
          className="w-40"
        />
        
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredItems.length} {filteredItems.length === 1 ? 'jogo' : 'jogos'}
          </span>
        )}
      </div>

      {isLoading ? (
        <GameCardGridSkeleton count={10} />
      ) : isError ? (
        <EstadoVazio
          icone={AlertTriangle}
          titulo="Não conseguimos carregar as tendências"
          descricao="Tente novamente em instantes."
          acao={{ label: 'Tentar novamente', onClick: () => globalThis.location.reload() }}
        />
      ) : items.length === 0 || filteredItems.length === 0 ? (
        <EstadoVazio
          icone={Flame}
          titulo="Sem tendências ainda"
          descricao={items.length === 0 ? 'Dê o primeiro sinal explorando o catálogo.' : 'Nenhum jogo encontrado com os filtros selecionados.'}
          acao={{ label: 'Explorar catálogo', to: '/catalogo' }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredItems.map((item, index) => (
            <Link
              key={item.product_id}
              to={`/jogo/${item.product_id}`}
              className="group rounded-xl overflow-hidden border border-border bg-card hover:border-primary transition-all relative"
            >
              <div className="aspect-[3/4] bg-muted overflow-hidden">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-4xl">🎮</div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm line-clamp-1">{item.title}</h3>
                <p className="text-xs text-warning mt-1 flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  {item.evidence}
                </p>
                {/* GAP-142: Badge de posição */}
                <span className="absolute top-2 left-2 text-[10px] font-bold bg-background/80 backdrop-blur text-foreground px-2 py-0.5 rounded-full border border-border flex items-center gap-1">
                  <Trophy className={`h-3 w-3 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  #{index + 1}
                </span>
                {/* GAP-143, GAP-470: Badge de plataforma */}
                {item.platform && item.platform.length > 0 && (
                  <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-card/80 backdrop-blur border border-border">
                    {item.platform[0].length > 8 ? item.platform[0].slice(0, 8) : item.platform[0]}
                  </span>
                )}
                {/* GAP-145: Badge de categoria */}
                {item.category && (
                  <span className="absolute bottom-12 left-2 text-[8px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                    {item.category}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}