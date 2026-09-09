import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Star, Heart, Filter, X, BookOpen, Image, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';
import { cn } from '@/lib/utils';

type Fav = { 
  content_type: string; 
  content_id: string; 
  created_at: string; 
  preview?: any 
};

type FilterType = 'all' | 'review' | 'opinion' | 'screenshot';

// GAP-SF02: Ícones por tipo
const TYPE_ICON: Record<string, any> = {
  review: Star,
  opinion: MessageSquare,
  screenshot: Image,
};

const TYPE_LABEL: Record<string, string> = {
  review: 'Review',
  opinion: 'Opinião',
  screenshot: 'Screenshot',
};

const TYPE_COLOR: Record<string, string> = {
  review: 'text-warning bg-warning/10',
  opinion: 'text-primary bg-primary/10',
  screenshot: 'text-accent bg-accent/10',
};

// GAP-SF04: Limite de itens por página
const ITEMS_PER_PAGE = 20;

export default function SocialFavorites() {
  const { user } = useAuth();
  const [items, setItems] = useState<Fav[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async (reset = true) => {
    if (!user) return;
    setLoading(true);
    
    const { data } = await supabase
      .from('social_favorites')
      .select('content_type, content_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(reset ? 0 : items.length, (reset ? 0 : items.length) + ITEMS_PER_PAGE - 1)
      .limit(ITEMS_PER_PAGE);
    
    const list = (data || []) as Fav[];
    setHasMore(list.length === ITEMS_PER_PAGE);
    
    if (reset) {
      setItems(list);
      setPage(1);
    } else {
      setItems(prev => [...prev, ...list]);
      setPage(prev => prev + 1);
    }
    
    // Hydrate
    const byType: Record<string, string[]> = {};
    list.forEach(f => { (byType[f.content_type] ||= []).push(f.content_id); });
    
    const hydrated: Record<string, any> = {};
    
    if (byType.review) {
      const { data: r } = await supabase
        .from('avaliacoes')
        .select('id, rating, comment, product_id, produtos!inner(title, image_url)')
        .in('id', byType.review);
      (r || []).forEach((x: any) => { hydrated[`review:${x.id}`] = x; });
    }
    if (byType.opinion) {
      const { data: r } = await supabase
        .from('game_opinions')
        .select('id, text, product_id, produtos!inner(title, image_url)')
        .in('id', byType.opinion);
      (r || []).forEach((x: any) => { hydrated[`opinion:${x.id}`] = x; });
    }
    if (byType.screenshot) {
      const { data: r } = await supabase
        .from('game_screenshots')
        .select('id, caption, product_id, images, produtos!inner(title, image_url)')
        .in('id', byType.screenshot);
      (r || []).forEach((x: any) => { hydrated[`screenshot:${x.id}`] = x; });
    }
    
    list.forEach(f => { f.preview = hydrated[`${f.content_type}:${f.content_id}`]; });
    
    if (reset) {
      setItems(list);
    } else {
      setItems(prev => [...prev, ...list]);
    }
    setLoading(false);
  }, [user, items.length]);

  useEffect(() => {
    load(true);
  }, [user?.id]);

  // GAP-SF02: Filtrar
  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(f => f.content_type === filter);
  }, [items, filter]);

  // GAP-SF03: Remover com animação
  const remove = async (f: Fav) => {
    if (!user || removing) return;
    setRemoving(`${f.content_type}:${f.content_id}`);
    await dbWrite(supabase.from('social_favorites').delete().match({ 
      user_id: user.id, 
      content_type: f.content_type, 
      content_id: f.content_id 
    }));
    setItems(prev => prev.filter(x => !(x.content_type === f.content_type && x.content_id === f.content_id)));
    toast.success('Removido dos favoritos');
    setRemoving(null);
  };

  // GAP-SF04: Carregar mais
  const loadMore = () => {
    if (!hasMore || loading) return;
    load(false);
  };

  if (loading && items.length === 0) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }
  
  const totalItems = items.length;

  return (
    <div className="space-y-4">
      {/* GAP-SF04: Header com contador */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Favoritos</span>
          <span className="text-xs text-muted-foreground">({totalItems})</span>
        </div>
        
        {/* GAP-SF02: Filtros */}
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {(['all', 'review', 'opinion', 'screenshot'] as FilterType[]).map(f => {
            const Icon = TYPE_ICON[f] || Heart;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded transition flex items-center gap-0.5",
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f !== 'all' && <Icon className="h-2.5 w-2.5" />}
                {f === 'all' ? 'Todos' : TYPE_LABEL[f]}
              </button>
            );
          })}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Heart className="h-8 w-8 mx-auto mb-2 opacity-50" />
          {filter === 'all' 
            ? 'Nada favoritado ainda. Toque no coração de uma review, opinião ou screenshot.'
            : `Nenhum ${TYPE_LABEL[filter]?.toLowerCase()} favoritado ainda.`}
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredItems.map(f => {
            const p = f.preview;
            if (!p) return null;
            const Icon = TYPE_ICON[f.content_type] || Heart;
            const colorClass = TYPE_COLOR[f.content_type] || 'text-muted-foreground bg-secondary';
            const isRemoving = removing === `${f.content_type}:${f.content_id}`;
            
            return (
              <li 
                key={`${f.content_type}-${f.content_id}`} 
                className={cn(
                  "bg-card border border-border rounded-xl p-4 flex gap-3 transition-all duration-300",
                  isRemoving && "opacity-0 scale-95"
                )}
              >
                {p.produtos?.image_url && (
                  <Link to={`/jogo/${p.product_id}`} className="shrink-0">
                    <img 
                      src={p.produtos.image_url} 
                      alt="" 
                      className="w-14 h-14 rounded-lg object-cover" 
                      loading="lazy" 
                    />
                  </Link>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn(
                      "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5",
                      colorClass
                    )}>
                      <Icon className="h-3 w-3" /> {TYPE_LABEL[f.content_type]}
                    </span>
                    <Link to={`/jogo/${p.product_id}`} className="text-sm font-semibold hover:text-primary truncate">
                      {p.produtos?.title}
                    </Link>
                    {f.content_type === 'review' && p.rating != null && (
                      <span className="inline-flex items-center gap-0.5 text-warning text-xs">
                        <Star className="h-3 w-3 fill-current" />{Number(p.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {p.comment || p.text || p.caption || ''}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => remove(f)} 
                  aria-label="Remover"
                  className="shrink-0"
                >
                  <Heart className="h-4 w-4 fill-current text-primary" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {/* GAP-SF01: Carregar mais */}
      {hasMore && filteredItems.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadMore} 
            disabled={loading}
            className="text-xs"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Carregar mais favoritos
          </Button>
        </div>
      )}
    </div>
  );
}