import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, ShoppingBag, ThumbsUp, MessageSquare, ChevronDown, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MobileBadge, MobileChip, MForumTag } from '@/mobile/lib/badge';
import { timeAgo } from '@/mobile/lib/time';
import { HalfStarDisplay } from '@/components/HalfStarRating';
import { getFollowingIds } from '@/mobile/lib/useFollow';
import OrbitRadar from '@/components/radar/OrbitRadar';
import { FeedItemSkeleton } from '@/components/skeletons';
import MOnboardingSheet from '@/mobile/components/MOnboardingSheet';
import DataSaverImage from '@/components/DataSaverImage';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency } from '@/lib/format';

type FeedItem =
  | { kind: 'forum'; id: string; created_at: string; content: string; author: string; authorId: string; product: string; likes: number; replies: number }
  | { kind: 'review'; id: string; created_at: string; rating: number; comment: string | null; author: string; authorId: string; product: string; productId: string }
  | { kind: 'ad'; id: string; created_at: string; title: string; price: number; image: string | null; seller: string; authorId: string };

const FILTERS = [
  { id: 'all', label: 'Tudo' },
  { id: 'following', label: 'Seguindo' },
  { id: 'forum', label: 'Fórum' },
  { id: 'review', label: 'Reviews' },
  { id: 'ad', label: 'Marketplace' },
] as const;
type Filter = typeof FILTERS[number]['id'];

// GAP-1074: Hook para Realtime
function useRealtimeFeed(onUpdate: () => void) {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('mhome-feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_posts' }, onUpdate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avaliacoes', filter: 'is_approved=eq.true' }, onUpdate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anuncios', filter: 'status=eq.active' }, onUpdate)
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [user, onUpdate]);
}

// GAP-1073: Constante de limite
const LIMIT = 20;

export default function MHome() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [allItems, setAllItems] = useState<FeedItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    if (!user) { setFollowingIds(new Set()); return; }
    getFollowingIds(user.id).then(ids => setFollowingIds(new Set(ids)));
  }, [user?.id]);

  // GAP-1074: Realtime
  const handleRealtimeUpdate = useCallback(() => {
    setReloadTrigger(prev => prev + 1);
  }, []);

  useRealtimeFeed(handleRealtimeUpdate);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mhome-feed', reloadTrigger],
    staleTime: 30_000,
    queryFn: async () => {
      const offset = 0;
      const [{ data: top }, { data: posts }, { data: reviews }, { data: ads }] = await Promise.all([
        supabase.from('produtos').select('id, title, image_url, rating').eq('is_active', true).order('rating', { ascending: false }).limit(5),
        supabase.from('forum_posts').select('id, content, created_at, likes_count, user_id, product_id').order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1),
        supabase.from('avaliacoes').select('id, rating, comment, created_at, user_id, product_id').eq('is_approved', true).order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1),
        supabase.from('anuncios').select('id, title, price, created_at, seller_id').eq('status', 'active').order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1),
      ]);

      const userIds = new Set<string>();
      const productIds = new Set<string>();
      const adIds: string[] = [];
      posts?.forEach(p => { userIds.add(p.user_id); productIds.add(p.product_id); });
      reviews?.forEach(r => { userIds.add(r.user_id); productIds.add(r.product_id); });
      ads?.forEach(a => { userIds.add(a.seller_id); adIds.push(a.id); });

      const [{ data: profiles }, { data: products }, { data: photos }, { data: replies }] = await Promise.all([
        userIds.size ? supabase.from('profiles').select('id, display_name').in('id', [...userIds]) : Promise.resolve({ data: [] as any }),
        productIds.size ? supabase.from('produtos').select('id, title').in('id', [...productIds]) : Promise.resolve({ data: [] as any }),
        adIds.length ? supabase.from('fotos_anuncio').select('anuncio_id, image_url, position').in('anuncio_id', adIds).order('position') : Promise.resolve({ data: [] as any }),
        posts?.length ? supabase.from('forum_replies').select('post_id').in('post_id', posts.map(p => p.id)) : Promise.resolve({ data: [] as any }),
      ]);

      const profileMap = new Map<string, string>((profiles || []).map((p: any) => [p.id as string, (p.display_name || 'Usuário') as string]));
      const productMap = new Map<string, string>((products || []).map((p: any) => [p.id as string, p.title as string]));
      const photoMap = new Map<string, string>();
      (photos || []).forEach((p: any) => { if (!photoMap.has(p.anuncio_id)) photoMap.set(p.anuncio_id, p.image_url); });
      const replyCount = new Map<string, number>();
      (replies || []).forEach((r: any) => replyCount.set(r.post_id, (replyCount.get(r.post_id) || 0) + 1));

      const items: FeedItem[] = [];
      posts?.forEach(p => items.push({
        kind: 'forum', id: p.id, created_at: p.created_at || '', content: p.content,
        author: profileMap.get(p.user_id) || 'Usuário', authorId: p.user_id,
        product: productMap.get(p.product_id) || 'Jogo',
        likes: p.likes_count, replies: replyCount.get(p.id) || 0,
      }));
      reviews?.forEach(r => items.push({
        kind: 'review', id: r.id, created_at: r.created_at, rating: Number(r.rating),
        comment: r.comment, author: profileMap.get(r.user_id) || 'Usuário', authorId: r.user_id,
        product: productMap.get(r.product_id) || 'Jogo', productId: r.product_id,
      }));
      ads?.forEach(a => items.push({
        kind: 'ad', id: a.id, created_at: a.created_at, title: a.title, price: Number(a.price),
        image: photoMap.get(a.id) || null, seller: profileMap.get(a.seller_id) || 'Vendedor', authorId: a.seller_id,
      }));
      items.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

      const hasMoreItems = (posts?.length || 0) >= LIMIT || (reviews?.length || 0) >= LIMIT || (ads?.length || 0) >= LIMIT;

      return { topGames: top || [], feed: items, hasMore: hasMoreItems };
    },
  });

  // GAP-1073: Carregar mais
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const offset = nextPage * LIMIT;

    const [{ data: posts }, { data: reviews }, { data: ads }] = await Promise.all([
      supabase.from('forum_posts').select('id, content, created_at, likes_count, user_id, product_id').order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1),
      supabase.from('avaliacoes').select('id, rating, comment, created_at, user_id, product_id').eq('is_approved', true).order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1),
      supabase.from('anuncios').select('id, title, price, created_at, seller_id').eq('status', 'active').order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1),
    ]);

    const userIds = new Set<string>();
    const productIds = new Set<string>();
    const adIds: string[] = [];
    posts?.forEach(p => { userIds.add(p.user_id); productIds.add(p.product_id); });
    reviews?.forEach(r => { userIds.add(r.user_id); productIds.add(r.product_id); });
    ads?.forEach(a => { userIds.add(a.seller_id); adIds.push(a.id); });

    const [{ data: profiles }, { data: products }, { data: photos }, { data: replies }] = await Promise.all([
      userIds.size ? supabase.from('profiles').select('id, display_name').in('id', [...userIds]) : Promise.resolve({ data: [] as any }),
      productIds.size ? supabase.from('produtos').select('id, title').in('id', [...productIds]) : Promise.resolve({ data: [] as any }),
      adIds.length ? supabase.from('fotos_anuncio').select('anuncio_id, image_url, position').in('anuncio_id', adIds).order('position') : Promise.resolve({ data: [] as any }),
      posts?.length ? supabase.from('forum_replies').select('post_id').in('post_id', posts.map(p => p.id)) : Promise.resolve({ data: [] as any }),
    ]);

    const profileMap = new Map<string, string>((profiles || []).map((p: any) => [p.id as string, (p.display_name || 'Usuário') as string]));
    const productMap = new Map<string, string>((products || []).map((p: any) => [p.id as string, p.title as string]));
    const photoMap = new Map<string, string>();
    (photos || []).forEach((p: any) => { if (!photoMap.has(p.anuncio_id)) photoMap.set(p.anuncio_id, p.image_url); });
    const replyCount = new Map<string, number>();
    (replies || []).forEach((r: any) => replyCount.set(r.post_id, (replyCount.get(r.post_id) || 0) + 1));

    const newItems: FeedItem[] = [];
    posts?.forEach(p => newItems.push({
      kind: 'forum', id: p.id, created_at: p.created_at || '', content: p.content,
      author: profileMap.get(p.user_id) || 'Usuário', authorId: p.user_id,
      product: productMap.get(p.product_id) || 'Jogo',
      likes: p.likes_count, replies: replyCount.get(p.id) || 0,
    }));
    reviews?.forEach(r => newItems.push({
      kind: 'review', id: r.id, created_at: r.created_at, rating: Number(r.rating),
      comment: r.comment, author: profileMap.get(r.user_id) || 'Usuário', authorId: r.user_id,
      product: productMap.get(r.product_id) || 'Jogo', productId: r.product_id,
    }));
    ads?.forEach(a => newItems.push({
      kind: 'ad', id: a.id, created_at: a.created_at, title: a.title, price: Number(a.price),
      image: photoMap.get(a.id) || null, seller: profileMap.get(a.seller_id) || 'Vendedor', authorId: a.seller_id,
    }));
    newItems.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    setAllItems(prev => [...prev, ...newItems]);
    setPage(nextPage);
    setHasMore((posts?.length || 0) >= LIMIT || (reviews?.length || 0) >= LIMIT || (ads?.length || 0) >= LIMIT);
    setLoadingMore(false);
  };

  useEffect(() => {
    if (data) {
      setAllItems(data.feed);
      setHasMore(data.hasMore || false);
      setPage(0);
    }
  }, [data]);

  const topGames = data?.topGames || [];
  const feed = allItems;

  const visible = useMemo(() => {
    const base = feed.filter(i => {
      if (filter === 'all') return true;
      if (filter === 'following') return followingIds.has(i.authorId);
      return i.kind === filter;
    });
    if (filter !== 'all') return base;
    const forum = base.filter(i => i.kind === 'forum');
    const reviews = base.filter(i => i.kind === 'review');
    const ads = base.filter(i => i.kind === 'ad');
    const out: FeedItem[] = [];
    while (forum.length || reviews.length || ads.length) {
      for (let i = 0; i < 4 && forum.length; i++) out.push(forum.shift()!);
      for (let i = 0; i < 3 && reviews.length; i++) out.push(reviews.shift()!);
      for (let i = 0; i < 3 && ads.length; i++) out.push(ads.shift()!);
    }
    return out;
  }, [feed, filter, followingIds]);

  return (
    <div className="px-4 py-5 space-y-6">
      <MOnboardingSheet />
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden p-5 glass"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 pointer-events-none" />
        <div className="relative">
          <h2 className="font-display text-2xl font-bold gradient-text leading-tight">Bem-vindo à MIDIAS</h2>
          <p className="text-sm text-muted-foreground mt-1">Comunidade, marketplace e reviews num só lugar.</p>
        </div>
      </motion.section>

      <OrbitRadar limit={4} compact />

      {topGames.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5"><Flame className="h-4 w-4 text-primary" /> Top jogos da plataforma</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-thin -mx-4 px-4 pb-1">
            {topGames.map(g => (
              <Link key={g.id} to={`/m/review/${g.id}`} className="shrink-0 w-32">
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-card border border-border/50 relative group">
                  {g.image_url
                    ? <DataSaverImage src={g.image_url} alt={g.title} saverWidth={256} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Flame className="h-8 w-8" /></div>}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <div className="text-[10px] text-on-media font-bold line-clamp-2">{g.title}</div>
                    {g.rating != null && <div className="flex items-center gap-1 mt-0.5"><HalfStarDisplay rating={Number(g.rating)} size={10} /></div>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin -mx-4 px-4 pb-2 mb-2">
          {FILTERS.map(f => (
            <MobileChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</MobileChip>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <FeedItemSkeleton key={i} />)}</div>
        ) : visible.length === 0 ? (
          <EstadoVazio
            icone={Flame}
            titulo={filter === 'following' ? (followingIds.size === 0 ? 'Você ainda não segue ninguém' : 'Quem você segue não postou nada ainda') : 'Nada por aqui ainda'}
            descricao={filter === 'following' && followingIds.size === 0 ? 'Visite perfis e siga pessoas para ver as publicações delas aqui.' : undefined}
          />
        ) : (
          <div className="space-y-3">
            {visible.map(item => <FeedCard key={`${item.kind}-${item.id}`} item={item} />)}
          </div>
        )}

        {/* GAP-1073: Carregar mais */}
        {!isLoading && hasMore && visible.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
            {loadingMore ? 'Carregando...' : 'Carregar mais'}
          </button>
        )}
      </section>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  if (item.kind === 'forum') {
    return (
      <Link to={`/m/forum/post/${item.id}`} className="block glass rounded-xl p-4 hover:border-primary/40 transition-colors">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <MForumTag name={item.product.toLowerCase().replace(/\s+/g, '').slice(0, 12)} />
            <MobileBadge tone="accent">Fórum</MobileBadge>
          </div>
          <span className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
        </div>
        <p className="text-sm text-foreground line-clamp-3">{item.content}</p>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          <span>por <b className="text-foreground">{item.author}</b></span>
          <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{item.likes}</span>
          <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{item.replies}</span>
        </div>
      </Link>
    );
  }
  if (item.kind === 'review') {
    return (
      <Link to={`/m/review/${item.productId}?focus=${item.id}`} className="block glass rounded-xl p-4 hover:border-accent/40 transition-colors">
        <div className="flex items-center justify-between mb-1.5">
          <MobileBadge tone="price">Review</MobileBadge>
          <span className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-foreground">{item.product}</span>
          <HalfStarDisplay rating={item.rating} size={12} />
        </div>
        {item.comment && <p className="text-sm text-foreground line-clamp-2">{item.comment}</p>}
        <div className="text-[11px] text-muted-foreground mt-2">por <b className="text-foreground">{item.author}</b></div>
      </Link>
    );
  }
  return (
    <Link to={`/m/marketplace/${item.id}`} className="block glass rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
      <div className="flex">
        <div className="w-24 h-24 shrink-0 bg-muted">
          {item.image ? <DataSaverImage src={item.image} alt={item.title} saverWidth={192} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-6 w-6 text-muted-foreground" /></div>}
        </div>
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <MobileBadge tone="primary">Marketplace</MobileBadge>
            <span className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
          </div>
          <p className="text-sm font-semibold text-foreground line-clamp-1">{item.title}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold text-price">{formatCurrency(item.price)}</span>
            <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">por {item.seller}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}