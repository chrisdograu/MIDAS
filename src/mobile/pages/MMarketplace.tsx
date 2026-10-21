import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, Loader2, ShieldCheck, ArrowLeftRight, ShoppingBag, SlidersHorizontal, X, Disc3, HardDrive, Gamepad2, Joystick, Sparkles, Package, Clock, TrendingDown, TrendingUp, ChevronDown, Bell } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { MobileChip } from '@/mobile/lib/badge';
import { timeAgo } from '@/mobile/lib/time';
import { useDebounce } from '@/hooks/useDebounce';
import DataSaverImage from '@/components/DataSaverImage';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Ad {
  id: string; title: string; price: number; ad_type: string; condition: string;
  certificate_type: string; created_at: string; seller_id: string;
  category: string; plataformas: string[] | null; image: string | null;
  seller_name: string; description: string | null; game_title: string | null;
  forum_game_ids: string[];
}

const TYPE_FILTERS = [
  { id: 'all', label: 'Tudo' },
  { id: 'venda', label: 'Venda' },
  { id: 'troca', label: 'Troca' },
] as const;

const CATEGORIES = [
  { id: 'all', label: 'Todas' },
  { id: 'jogo_fisico', label: 'Físico' },
  { id: 'jogo_digital', label: 'Digital' },
  { id: 'acessorio', label: 'Acessório' },
  { id: 'console', label: 'Console' },
];

const PLATFORMS = ['PS5','PS4','Xbox Series X','Xbox One','Switch','PC','Mobile'];
const CONDITIONS = [
  { id: 'all', label: 'Qualquer' },
  { id: 'novo', label: 'Novo' },
  { id: 'seminovo', label: 'Seminovo' },
  { id: 'usado', label: 'Usado' },
  { id: 'recondicionado', label: 'Recondicionado' },
];
const CONDITION_LABEL: Record<string, string> = {
  novo: '✨ Novo', seminovo: '🌟 Seminovo', usado: '📦 Usado', recondicionado: '🔧 Recond.',
};
const SORTS = [
  { id: 'recent', label: 'Recentes' },
  { id: 'price_asc', label: 'Mais barato' },
  { id: 'price_desc', label: 'Mais caro' },
] as const;

// GAP-1080: Constante de limite
const LIMIT = 24;

// GAP-1080: Hook para Realtime
function useRealtimeAds(onNewAd: () => void) {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('marketplace-realtime')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'anuncios', 
        filter: 'status=eq.active' 
      }, (payload) => {
        const newAd = payload.new as any;
        toast.info(`📦 Novo anúncio: ${newAd.title}`, {
          duration: 5000,
          action: {
            label: 'Ver',
            onClick: () => window.location.reload(),
          }
        });
        onNewAd();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [user, onNewAd]);
}

export default function MMarketplace() {
  const [searchParams] = useSearchParams();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<typeof TYPE_FILTERS[number]['id']>('all');
  const [onlyProtected, setOnlyProtected] = useState(false);
  const [category, setCategory] = useState('all');
  const [platform, setPlatform] = useState<string | null>(null);
  const [condition, setCondition] = useState('all');
  const [priceMax, setPriceMax] = useState<number>(0);
  const [sort, setSort] = useState<typeof SORTS[number]['id']>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [gameFilter, setGameFilter] = useState<string | null>(null);
  const [gameOptions, setGameOptions] = useState<{ id: string; title: string }[]>([]);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // GAP-1080: Realtime
  const handleNewAd = useCallback(() => {
    setReloadTrigger(prev => prev + 1);
  }, []);

  useRealtimeAds(handleNewAd);

  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    const tagParam = searchParams.get('tag') || '';
    if (qParam && !query) setQuery(qParam);
    if (tagParam && !query) setQuery(tagParam.replace(/-/g, ' '));
  }, [searchParams]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const offset = 0;
      const nowIso = new Date().toISOString();
      const { data: list, error } = await supabase
        .from('anuncios').select('*').eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1);
      if (error) {
        if (!cancel) { setAds([]); setLoading(false); }
        return;
      }
      if (!list) { if (!cancel) { setAds([]); setLoading(false); } return; }

      const ids = list.map(a => a.id);
      const sellers = [...new Set(list.map(a => a.seller_id))];
      const [{ data: photos }, { data: profiles }, { data: vacationing }] = await Promise.all([
        supabase.from('fotos_anuncio').select('anuncio_id, image_url, position').in('anuncio_id', ids).order('position'),
        supabase.from('profiles').select('id, display_name, is_paused').in('id', sellers),
        supabase.from('seller_profiles').select('user_id, vacation_mode, admin_suspended').in('user_id', sellers),
      ]);
      const vacationSet = new Set((vacationing || []).filter((s: any) => s.vacation_mode || s.admin_suspended).map((s: any) => s.user_id));
      (profiles || []).forEach((p: any) => { if (p.is_paused) vacationSet.add(p.id); });
      const photo = new Map<string, string>();
      photos?.forEach(p => { if (!photo.has(p.anuncio_id)) photo.set(p.anuncio_id, p.image_url); });
      const seller = new Map((profiles || []).map(p => [p.id, p.display_name || 'Vendedor']));

      if (!cancel) {
        const newAds = list.filter(a => !vacationSet.has(a.seller_id)).map(a => ({
          id: a.id, title: a.title, price: Number(a.price), ad_type: a.ad_type,
          condition: a.condition, certificate_type: a.certificate_type, created_at: a.created_at,
          seller_id: a.seller_id, category: a.category, plataformas: a.plataformas,
          image: photo.get(a.id) || null, seller_name: seller.get(a.seller_id) || 'Vendedor',
          description: a.description || null, game_title: a.game_title || null,
          forum_game_ids: (a as any).forum_game_ids || [],
        }));
        setAds(newAds);
        setHasMore(list.length >= LIMIT);
        setPage(1);
        setLoading(false);
      }

      const gameIds = [...new Set(list.flatMap((a: any) => (a.forum_game_ids || []) as string[]))];
      if (gameIds.length && !cancel) {
        const { data: gamesRows } = await supabase
          .from('games_catalog').select('id, title').in('id', gameIds);
        if (!cancel) {
          setGameOptions((gamesRows || [])
            .map((g: any) => ({ id: g.id, title: g.title }))
            .sort((a, b) => a.title.localeCompare(b.title)));
        }
      }
    })();
    return () => { cancel = true; };
  }, [reloadTrigger]);

  // GAP-1079: Carregar mais
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const offset = nextPage * LIMIT;
    const nowIso = new Date().toISOString();

    const { data: list } = await supabase
      .from('anuncios').select('*').eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1);

    if (!list || list.length === 0) {
      setHasMore(false);
      setLoadingMore(false);
      return;
    }

    const ids = list.map(a => a.id);
    const sellers = [...new Set(list.map(a => a.seller_id))];
    const [{ data: photos }, { data: profiles }, { data: vacationing }] = await Promise.all([
      supabase.from('fotos_anuncio').select('anuncio_id, image_url, position').in('anuncio_id', ids).order('position'),
      supabase.from('profiles').select('id, display_name, is_paused').in('id', sellers),
      supabase.from('seller_profiles').select('user_id, vacation_mode, admin_suspended').in('user_id', sellers),
    ]);
    const vacationSet = new Set((vacationing || []).filter((s: any) => s.vacation_mode || s.admin_suspended).map((s: any) => s.user_id));
    (profiles || []).forEach((p: any) => { if (p.is_paused) vacationSet.add(p.id); });
    const photo = new Map<string, string>();
    photos?.forEach(p => { if (!photo.has(p.anuncio_id)) photo.set(p.anuncio_id, p.image_url); });
    const seller = new Map((profiles || []).map(p => [p.id, p.display_name || 'Vendedor']));

    const newAds = list.filter(a => !vacationSet.has(a.seller_id)).map(a => ({
      id: a.id, title: a.title, price: Number(a.price), ad_type: a.ad_type,
      condition: a.condition, certificate_type: a.certificate_type, created_at: a.created_at,
      seller_id: a.seller_id, category: a.category, plataformas: a.plataformas,
      image: photo.get(a.id) || null, seller_name: seller.get(a.seller_id) || 'Vendedor',
      description: a.description || null, game_title: a.game_title || null,
      forum_game_ids: (a as any).forum_game_ids || [],
    }));

    setAds(prev => [...prev, ...newAds]);
    setPage(nextPage);
    setHasMore(list.length >= LIMIT);
    setLoadingMore(false);
  };

  const debouncedQuery = useDebounce(query, 200);
  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let r = ads.filter(a => {
      if (q) {
        const haystack = [a.title, a.game_title, a.description, a.category, ...(a.plataformas || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const qTag = q.replace(/[:_]+/g, ' ').replace(/-/g, ' ');
        if (!haystack.includes(qTag)) return false;
      }
      if (type !== 'all' && a.ad_type !== type) return false;
      if (onlyProtected && a.certificate_type === 'sem_certificado') return false;
      if (category !== 'all' && a.category !== category) return false;
      if (platform && !(a.plataformas || []).includes(platform)) return false;
      if (condition !== 'all' && a.condition !== condition) return false;
      if (priceMax > 0 && a.price > priceMax) return false;
      if (gameFilter && !(a.forum_game_ids || []).includes(gameFilter)) return false;
      return true;
    });
    if (sort === 'price_asc') r = [...r].sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') r = [...r].sort((a, b) => b.price - a.price);
    return r;
  }, [ads, debouncedQuery, type, onlyProtected, category, platform, condition, priceMax, sort, gameFilter]);

  const activeFilters = (category !== 'all' ? 1 : 0) + (platform ? 1 : 0) + (condition !== 'all' ? 1 : 0) + (priceMax > 0 ? 1 : 0) + (sort !== 'recent' ? 1 : 0) + (gameFilter ? 1 : 0);

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold gradient-text">Marketplace</h1>
        <Link to="/m/marketplace/novo" className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground glow-primary">
          <Plus className="h-3.5 w-3.5" /> Anunciar
        </Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar jogos, consoles, acessórios..."
            className="w-full pl-10 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button onClick={() => setFiltersOpen(true)} className="relative px-3 rounded-xl bg-card border border-border">
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{activeFilters}</span>}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin -mx-4 px-4">
        {TYPE_FILTERS.map(f => <MobileChip key={f.id} active={type === f.id} onClick={() => setType(f.id)}>{f.label}</MobileChip>)}
        <MobileChip active={onlyProtected} onClick={() => setOnlyProtected(v => !v)}>
          <ShieldCheck className="h-3 w-3 mr-1 inline" /> Protegidos
        </MobileChip>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EstadoVazio
          icone={ShoppingBag}
          titulo="Nenhum anúncio encontrado"
          descricao="Ajuste os filtros ou seja você a criar o primeiro anúncio."
          acao={{ label: '+ Criar anúncio', to: '/m/marketplace/novo' }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                <Link to={`/m/marketplace/${a.id}`} className="block glass rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
                  <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                    {a.image
                      ? <DataSaverImage src={a.image} alt={a.title} saverWidth={320} className="w-full h-full object-contain bg-muted" />
                      : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-8 w-8 text-muted-foreground" /></div>}
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex flex-wrap gap-1">
                      {a.certificate_type !== 'sem_certificado' && (
                        <span className="backdrop-blur-md bg-success/80 text-on-media text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-success/40 flex items-center gap-0.5"><ShieldCheck className="h-2.5 w-2.5" />Protegido</span>
                      )}
                      {a.ad_type === 'troca' && (
                        <span className="backdrop-blur-md bg-accent/80 text-on-media text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-accent/40 flex items-center gap-0.5"><ArrowLeftRight className="h-2.5 w-2.5" />Troca</span>
                      )}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight min-h-[2rem]">{a.title}</p>
                    <p className="text-base font-bold text-price mt-1">{a.ad_type === 'troca' ? 'Troca' : `${formatCurrency(a.price)}`}</p>
                    <div className="flex items-center justify-between mt-0.5 gap-1">
                      <p className="text-[10px] text-muted-foreground truncate flex-1">{a.seller_name} · {timeAgo(a.created_at)}</p>
                      <span className="text-[9px] font-semibold text-muted-foreground bg-secondary/60 rounded px-1 py-0.5 shrink-0">{CONDITION_LABEL[a.condition] || a.condition}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* GAP-1079: Carregar mais */}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
              {loadingMore ? 'Carregando...' : 'Carregar mais anúncios'}
            </button>
          )}
        </>
      )}

      {/* Drawer de filtros */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 overlay-scrim flex items-end" onClick={() => setFiltersOpen(false)}>
          <motion.div initial={{ y: 400 }} animate={{ y: 0 }} className="w-full max-h-[85vh] overflow-y-auto bg-card rounded-t-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Filtros</h3>
              <button onClick={() => setFiltersOpen(false)}><X className="h-5 w-5" /></button>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Categoria</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {CATEGORIES.map(c => <MobileChip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</MobileChip>)}
              </div>
            </div>

            {gameOptions.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Jogo</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <MobileChip active={!gameFilter} onClick={() => setGameFilter(null)}>Todos</MobileChip>
                  {gameOptions.map(g => (
                    <MobileChip key={g.id} active={gameFilter === g.id} onClick={() => setGameFilter(g.id)}>{g.title}</MobileChip>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Só filtra quando você escolhe um jogo — anúncios com tag continuam na lista geral.</p>
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Plataforma</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <MobileChip active={!platform} onClick={() => setPlatform(null)}>Todas</MobileChip>
                {PLATFORMS.map(p => <MobileChip key={p} active={platform === p} onClick={() => setPlatform(p)}>{p}</MobileChip>)}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Condição</label>
              <div className="flex gap-1.5 mt-1.5">
                {CONDITIONS.map(c => <MobileChip key={c.id} active={condition === c.id} onClick={() => setCondition(c.id)}>{c.label}</MobileChip>)}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Preço máximo: {priceMax > 0 ? `R$ ${priceMax}` : 'sem limite'}</label>
              <input type="range" min={0} max={500} step={10} value={priceMax} onChange={e => setPriceMax(Number(e.target.value))} className="w-full mt-1.5 accent-primary" />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ordenar por</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {SORTS.map(s => <MobileChip key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</MobileChip>)}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setCategory('all'); setPlatform(null); setCondition('all'); setPriceMax(0); setSort('recent'); setGameFilter(null); }} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold">Limpar</button>
              <button onClick={() => setFiltersOpen(false)} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold">Aplicar</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}