import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Search, MessagesSquare, TrendingUp, Clock, MessageSquare, ThumbsUp, Star, Flame, Gamepad2, Users, Newspaper, Lightbulb, Send, X, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MobileChip, MForumTag, MobileBadge } from '@/mobile/lib/badge';
import { timeAgo, periodSince, type Period, PERIOD_OPTIONS } from '@/mobile/lib/time';
import { HalfStarDisplay } from '@/components/HalfStarRating';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/hooks/useAuth';
import { ItemActionsMenu } from '@/components/ItemActionsMenu';
import { toast } from 'sonner';
import SpoilerGuard from '@/components/spoiler/SpoilerGuard';
import EstadoVazio from '@/components/EstadoVazio';
import { dbWrite } from '@/lib/dbWrite';

type Sort = 'popular' | 'recent' | 'commented';
type Tab = 'tudo' | 'posts' | 'reviews';
const SORTS: { id: Sort; label: string; icon: any }[] = [
  { id: 'popular', label: 'Populares', icon: TrendingUp },
  { id: 'recent', label: 'Recentes', icon: Clock },
  { id: 'commented', label: 'Comentados', icon: MessageSquare },
];

interface TopGame { id: string; title: string; image_url: string | null; postCount: number }
interface ForumPost {
  id: string; content: string; created_at: string; likes_count: number; user_id: string;
  product_id: string; replies_count: number; author: string; product: string;
  is_spoiler: boolean; spoiler_achievement_name: string | null;
}
interface ForumReview {
  id: string; rating: number; comment: string | null; created_at: string; user_id: string;
  product_id: string; author: string; product: string; likes: number;
  is_spoiler: boolean; spoiler_achievement_name: string | null;
  user_liked?: boolean;
}

// GAP-1037: Função para curtir review
async function toggleReviewLike(reviewId: string, userId: string): Promise<boolean> {
  // Verificar se já curtiu
  const { data: existing } = await supabase
    .from('review_likes')
    .select('id')
    .eq('review_id', reviewId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (existing) {
    const { error } = await supabase
      .from('review_likes')
      .delete()
      .eq('id', existing.id);
    if (error) return false;
  } else {
    const { error } = await supabase
      .from('review_likes')
      .insert({ review_id: reviewId, user_id: userId });
    if (error) return false;
  }
  return true;
}

export default function MForum() {
  const [tab, setTab] = useState<Tab>('tudo');
  
  const [sort, setSort] = useState<Sort>('popular');
  const [period, setPeriod] = useState<Period>('week');
  const [query, setQuery] = useState('');
  const [topGames, setTopGames] = useState<TopGame[]>([]);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [reviews, setReviews] = useState<ForumReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const [communityHits, setCommunityHits] = useState<{ id: string; title: string; image_url: string | null }[]>([]);
  const [communityCats, setCommunityCats] = useState<{ slug: string; name: string; description: string | null; parent_slug: string | null }[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestDesc, setSuggestDesc] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [mySuggestions, setMySuggestions] = useState<{ id: string; title: string; status: string; admin_notes: string | null; created_product_id: string | null }[]>([]);

  // GAP-1035: Constante de limite
  const LIMIT = 20;

  const loadMySuggestions = async (uid: string) => {
    const { data } = await supabase
      .from('game_suggestions')
      .select('id, title, status, admin_notes, created_product_id')
      .eq('requested_by', uid)
      .order('created_at', { ascending: false })
      .limit(10);
    setMySuggestions(data || []);
  };

  useEffect(() => { if (user) loadMySuggestions(user.id); else setMySuggestions([]); }, [user?.id]);

  useEffect(() => {
    supabase.from('forum_categories').select('slug,name,description,parent_slug').eq('is_community', true).order('display_order')
      .then(({ data }) => setCommunityCats((data as any) || []));
  }, []);

  const submitSuggestion = async () => {
    if (!user) { toast.error('Entre para sugerir'); navigate('/m/auth'); return; }
    const title = suggestTitle.trim();
    if (title.length < 2) { toast.error('Título muito curto'); return; }
    setSuggesting(true);
    const { error } = await supabase.from('game_suggestions').insert({
      requested_by: user.id,
      title,
      description: suggestDesc.trim() || null,
    });
    setSuggesting(false);
    if (error) { toast.error('Erro ao enviar sugestão'); return; }
    toast.success('🎮 Sugestão enviada para revisão da equipe!');
    setSuggestTitle(''); setSuggestDesc(''); setSuggestOpen(false);
    loadMySuggestions(user.id);
  };

  // GAP-1037: Curtir review
  const handleLikeReview = async (reviewId: string) => {
    if (!user) { toast.error('Entre para curtir'); return; }
    const success = await toggleReviewLike(reviewId, user.id);
    if (success) {
      setReviews(prev => prev.map(r => {
        if (r.id === reviewId) {
          const isLiked = r.user_liked || false;
          return {
            ...r,
            likes: isLiked ? r.likes - 1 : r.likes + 1,
            user_liked: !isLiked,
          };
        }
        return r;
      }));
    } else {
      toast.error('Erro ao curtir review');
    }
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setPage(0);
      pageRef.current = 0;
      setHasMore(true);
      const since = periodSince(period);
      const sinceISO = since ? since.toISOString() : '1970-01-01';

      const [{ data: rawPosts }, { data: rawReviews }] = await Promise.all([
        supabase.from('forum_posts').select('id, content, created_at, likes_count, user_id, product_id, is_spoiler, spoiler_achievement_name').gte('created_at', sinceISO).limit(LIMIT),
        supabase.from('avaliacoes').select('id, rating, comment, created_at, user_id, product_id, is_spoiler, spoiler_achievement_name').eq('is_approved', true).gte('created_at', sinceISO).limit(LIMIT),
      ]);

      // Buscar likes do usuário nas reviews (GAP-1037)
      let userLikes: Set<string> = new Set();
      if (user && rawReviews?.length) {
        const reviewIds = rawReviews.map(r => r.id);
        const { data: likes } = await supabase
          .from('review_likes')
          .select('review_id')
          .eq('user_id', user.id)
          .in('review_id', reviewIds);
        userLikes = new Set((likes || []).map(l => l.review_id));
      }

      const userIds = new Set<string>();
      const productIds = new Set<string>();
      rawPosts?.forEach(p => { userIds.add(p.user_id); productIds.add(p.product_id); });
      rawReviews?.forEach(r => { userIds.add(r.user_id); productIds.add(r.product_id); });
      const postIds = rawPosts?.map(p => p.id) || [];
      const reviewIds = rawReviews?.map(r => r.id) || [];

      const [{ data: profiles }, { data: replies }, { data: products }, { data: rLikes }] = await Promise.all([
        userIds.size ? supabase.from('profiles').select('id, display_name').in('id', [...userIds]) : Promise.resolve({ data: [] }),
        postIds.length ? supabase.from('forum_replies').select('post_id').in('post_id', postIds) : Promise.resolve({ data: [] }),
        productIds.size ? supabase.from('produtos').select('id, title, image_url').in('id', [...productIds]) : Promise.resolve({ data: [] }),
        reviewIds.length ? supabase.from('review_likes').select('review_id').in('review_id', reviewIds) : Promise.resolve({ data: [] }),
      ]);
      const productMap = new Map((products || []).map(p => [p.id, p]));
      const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name || 'Usuário']));
      const replyCount = new Map<string, number>();
      (replies || []).forEach(r => replyCount.set(r.post_id, (replyCount.get(r.post_id) || 0) + 1));
      const likeCount = new Map<string, number>();
      (rLikes || []).forEach((l: any) => likeCount.set(l.review_id, (likeCount.get(l.review_id) || 0) + 1));

      const countByGame = new Map<string, number>();
      rawPosts?.forEach(p => countByGame.set(p.product_id, (countByGame.get(p.product_id) || 0) + 1));
      rawReviews?.forEach(r => countByGame.set(r.product_id, (countByGame.get(r.product_id) || 0) + 1));
      const top: TopGame[] = [...countByGame.entries()]
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([id, c]) => {
          const p = productMap.get(id);
          return { id, title: p?.title || 'Jogo', image_url: p?.image_url || null, postCount: c };
        });
      if (top.length === 0) {
        const { data: fallback } = await supabase.from('produtos').select('id, title, image_url').eq('is_active', true).order('rating', { ascending: false }).limit(10);
        if (fallback?.length) top.push(...fallback.map(p => ({ id: p.id, title: p.title, image_url: p.image_url, postCount: 0 })));
      }

      const postsList: ForumPost[] = (rawPosts || []).map((p: any) => ({
        id: p.id, content: p.content, created_at: p.created_at || '',
        likes_count: p.likes_count, user_id: p.user_id, product_id: p.product_id,
        replies_count: replyCount.get(p.id) || 0,
        author: profileMap.get(p.user_id) || 'Usuário',
        product: productMap.get(p.product_id)?.title || 'Jogo',
        is_spoiler: !!p.is_spoiler, spoiler_achievement_name: p.spoiler_achievement_name || null,
      }));
      const reviewsList: ForumReview[] = (rawReviews || []).map((r: any) => ({
        id: r.id, rating: Number(r.rating), comment: r.comment, created_at: r.created_at,
        user_id: r.user_id, product_id: r.product_id,
        author: profileMap.get(r.user_id) || 'Usuário',
        product: productMap.get(r.product_id)?.title || 'Jogo',
        likes: likeCount.get(r.id) || 0,
        is_spoiler: !!r.is_spoiler, spoiler_achievement_name: r.spoiler_achievement_name || null,
        user_liked: userLikes.has(r.id),
      }));
      if (!cancel) { setTopGames(top); setPosts(postsList); setReviews(reviewsList); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [period, user?.id]);

  // GAP-1035: Carregar mais
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    const since = periodSince(period);
    const sinceISO = since ? since.toISOString() : '1970-01-01';
    const offset = nextPage * LIMIT;

    const [{ data: rawPosts }, { data: rawReviews }] = await Promise.all([
      supabase.from('forum_posts').select('id, content, created_at, likes_count, user_id, product_id, is_spoiler, spoiler_achievement_name').gte('created_at', sinceISO).range(offset, offset + LIMIT - 1),
      supabase.from('avaliacoes').select('id, rating, comment, created_at, user_id, product_id, is_spoiler, spoiler_achievement_name').eq('is_approved', true).gte('created_at', sinceISO).range(offset, offset + LIMIT - 1),
    ]);

    if (!rawPosts?.length && !rawReviews?.length) {
      setHasMore(false);
      setLoadingMore(false);
      return;
    }

    let userLikes: Set<string> = new Set();
    if (user && rawReviews?.length) {
      const reviewIds = rawReviews.map(r => r.id);
      const { data: likes } = await supabase
        .from('review_likes')
        .select('review_id')
        .eq('user_id', user.id)
        .in('review_id', reviewIds);
      userLikes = new Set((likes || []).map(l => l.review_id));
    }

    const userIds = new Set<string>();
    const productIds = new Set<string>();
    rawPosts?.forEach(p => { userIds.add(p.user_id); productIds.add(p.product_id); });
    rawReviews?.forEach(r => { userIds.add(r.user_id); productIds.add(r.product_id); });
    const postIds = rawPosts?.map(p => p.id) || [];
    const reviewIds = rawReviews?.map(r => r.id) || [];

    const [{ data: profiles }, { data: replies }, { data: products }, { data: rLikes }] = await Promise.all([
      userIds.size ? supabase.from('profiles').select('id, display_name').in('id', [...userIds]) : Promise.resolve({ data: [] }),
      postIds.length ? supabase.from('forum_replies').select('post_id').in('post_id', postIds) : Promise.resolve({ data: [] }),
      productIds.size ? supabase.from('produtos').select('id, title, image_url').in('id', [...productIds]) : Promise.resolve({ data: [] }),
      reviewIds.length ? supabase.from('review_likes').select('review_id').in('review_id', reviewIds) : Promise.resolve({ data: [] }),
    ]);
    const productMap = new Map((products || []).map(p => [p.id, p]));
    const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name || 'Usuário']));
    const replyCount = new Map<string, number>();
    (replies || []).forEach(r => replyCount.set(r.post_id, (replyCount.get(r.post_id) || 0) + 1));
    const likeCount = new Map<string, number>();
    (rLikes || []).forEach((l: any) => likeCount.set(l.review_id, (likeCount.get(l.review_id) || 0) + 1));

    const newPosts: ForumPost[] = (rawPosts || []).map((p: any) => ({
      id: p.id, content: p.content, created_at: p.created_at || '',
      likes_count: p.likes_count, user_id: p.user_id, product_id: p.product_id,
      replies_count: replyCount.get(p.id) || 0,
      author: profileMap.get(p.user_id) || 'Usuário',
      product: productMap.get(p.product_id)?.title || 'Jogo',
      is_spoiler: !!p.is_spoiler, spoiler_achievement_name: p.spoiler_achievement_name || null,
    }));
    const newReviews: ForumReview[] = (rawReviews || []).map((r: any) => ({
      id: r.id, rating: Number(r.rating), comment: r.comment, created_at: r.created_at,
      user_id: r.user_id, product_id: r.product_id,
      author: profileMap.get(r.user_id) || 'Usuário',
      product: productMap.get(r.product_id) || 'Jogo',
      likes: likeCount.get(r.id) || 0,
      is_spoiler: !!r.is_spoiler, spoiler_achievement_name: r.spoiler_achievement_name || null,
      user_liked: userLikes.has(r.id),
    }));

    setPosts(prev => [...prev, ...newPosts]);
    setReviews(prev => [...prev, ...newReviews]);
    setPage(nextPage);
    setHasMore((rawPosts?.length || 0) >= LIMIT || (rawReviews?.length || 0) >= LIMIT);
    setLoadingMore(false);
  };

  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) { setCommunityHits([]); return; }
    let cancel = false;
    supabase.from('produtos').select('id, title, image_url').eq('is_active', true).ilike('title', `%${q}%`).limit(6)
      .then(({ data }) => { if (!cancel) setCommunityHits(data || []); });
    return () => { cancel = true; };
  }, [debouncedQuery]);

  const sortedPosts = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let arr = posts.filter(p => !q || p.content.toLowerCase().includes(q) || p.product.toLowerCase().includes(q));
    if (sort === 'recent') arr = [...arr].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === 'commented') arr = [...arr].sort((a, b) => b.replies_count - a.replies_count);
    else arr = [...arr].sort((a, b) => (b.likes_count + b.replies_count * 2) - (a.likes_count + a.replies_count * 2));
    return arr;
  }, [posts, sort, debouncedQuery]);

  const sortedReviews = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let arr = reviews.filter(r => !q || (r.comment || '').toLowerCase().includes(q) || r.product.toLowerCase().includes(q));
    if (sort === 'recent') arr = [...arr].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === 'commented') arr = [...arr].sort((a, b) => b.rating - a.rating);
    else arr = [...arr].sort((a, b) => (b.likes - a.likes) || (b.rating - a.rating));
    return arr;
  }, [reviews, sort, debouncedQuery]);

  return (
    <div className="px-4 py-5 space-y-4">
      <h1 className="font-display text-xl font-bold gradient-text flex items-center gap-2">
        <MessagesSquare className="h-5 w-5" /> Fórum MIDIAS
      </h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar posts, reviews, jogos..." className="w-full pl-10 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      {communityCats.length > 0 && (
        <section className="rounded-xl border border-accent/40 bg-gradient-to-br from-accent/10 to-primary/5 p-3">
          <h2 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 gradient-text">
            <Users className="h-3.5 w-3.5" /> Comunidade
          </h2>
          <p className="text-[10px] text-muted-foreground mb-2">Discussões gerais MIDIAS — não atreladas a um jogo específico.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {communityCats.filter(c => c.parent_slug).map(c => (
              <Link key={c.slug} to={`/m/forum-comunidade/${c.slug}`}
                className="glass rounded-lg p-2 hover:border-accent/40 transition-colors">
                <p className="text-[11px] font-semibold truncate">{c.name}</p>
                {c.description && <p className="text-[9px] text-muted-foreground line-clamp-1">{c.description}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {communityHits.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-accent" /> Comunidades</h2>
          <div className="space-y-1.5">
            {communityHits.map(g => (
              <Link key={g.id} to={`/m/forum/${g.id}`} className="flex items-center gap-2.5 glass rounded-lg p-2 hover:border-primary/40">
                <div className="w-10 h-12 rounded bg-muted overflow-hidden shrink-0">
                  {g.image_url ? <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Gamepad2 className="h-4 w-4" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <MForumTag name={g.title.toLowerCase().replace(/\s+/g, '').slice(0, 14)} />
                  <p className="text-xs font-semibold truncate mt-0.5">{g.title}</p>
                </div>
                <span className="text-[10px] text-primary font-semibold">Abrir →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Flame className="h-3.5 w-3.5 text-primary" /> Top 10 Jogos</h2>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin -mx-4 px-4 pb-1">
          {topGames.length === 0 && <p className="text-sm text-muted-foreground">Nenhum jogo ativo ainda.</p>}
          {topGames.map((g, i) => (
            <Link key={g.id} to={`/m/forum/${g.id}`} className="shrink-0 w-28 glass rounded-xl overflow-hidden hover:border-accent/40 transition-colors">
              <div className="aspect-[3/4] bg-muted relative">
                {g.image_url ? <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Gamepad2 className="h-6 w-6" /></div>}
                <div className="absolute top-1 left-1 bg-accent text-accent-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">#{i + 1}</div>
              </div>
              <div className="p-1.5">
                <MForumTag name={g.title.toLowerCase().replace(/\s+/g, '').slice(0, 10)} />
                <p className="text-[10px] text-muted-foreground mt-0.5">{g.postCount} itens</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {debouncedQuery.trim().length >= 2 && communityHits.length === 0 && (
        <button onClick={() => setSuggestOpen(true)} className="w-full glass rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-semibold hover:border-accent/40 transition-colors">
          <Lightbulb className="h-4 w-4 text-accent" />
          Não achou "{debouncedQuery.trim()}"? <span className="gradient-text">Sugerir adição</span>
        </button>
      )}

      {mySuggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold px-1">Minhas sugestões</p>
          {mySuggestions.map(s => (
            <div key={s.id} className="glass rounded-lg p-2.5 text-xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{s.title}</span>
                <MobileBadge tone={s.status === 'aprovado' ? 'success' : s.status === 'rejeitado' ? 'warning' : 'muted'}>
                  {s.status === 'aprovado' ? '✅ Aprovada' : s.status === 'rejeitado' ? '❌ Rejeitada' : '⏳ Pendente'}
                </MobileBadge>
              </div>
              {s.status === 'rejeitado' && s.admin_notes && (
                <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-destructive">Motivo:</span> {s.admin_notes}</p>
              )}
              {s.status === 'aprovado' && s.created_product_id && (
                <Link to={`/m/forum/${s.created_product_id}`} className="text-[11px] text-accent underline">Ver fórum do jogo →</Link>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex p-1 bg-secondary/50 rounded-lg">
        <button onClick={() => setTab('tudo')} className={`flex-1 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 ${tab === 'tudo' ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground' : 'text-muted-foreground'}`}>
          <Flame className="h-3.5 w-3.5" /> Tudo
        </button>
        <button onClick={() => setTab('posts')} className={`flex-1 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 ${tab === 'posts' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
          <Newspaper className="h-3.5 w-3.5" /> Posts
        </button>
        <button onClick={() => setTab('reviews')} className={`flex-1 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 ${tab === 'reviews' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
          <Star className="h-3.5 w-3.5" /> Reviews
        </button>
      </div>

      {/* Filtros sempre visíveis: ordenar + período em linhas roláveis */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 pr-1">Ordenar</span>
          {SORTS.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${sort === s.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border'}`}
              >
                <Icon className="h-3 w-3" /> {s.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 pr-1">Período</span>
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${period === p.id ? 'bg-accent text-accent-foreground border-accent' : 'bg-card text-muted-foreground border-border'}`}
            >
              {p.label}
            </button>
          ))}
          {(sort !== 'popular' || period !== 'week' || query) && (
            <button
              onClick={() => { setSort('popular'); setPeriod('week'); setQuery(''); }}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-border bg-secondary/60 text-muted-foreground"
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : tab === 'posts' ? (
        <div className="space-y-2.5">
          {sortedPosts.length === 0 ? (
            <EstadoVazio
              icone={Newspaper}
              titulo="Nenhum post no período"
              descricao="Que tal começar a discussão? Crie o primeiro post da comunidade."
              acao={{ label: '+ Criar post', to: '/m/forum/comunidade/novidades' }}
            />
          ) : sortedPosts.map(p => <PostCard key={p.id} p={p} onDeleted={() => setPosts(prev => prev.filter(x => x.id !== p.id))} />)}
        </div>
      ) : tab === 'reviews' ? (
        <div className="space-y-2.5">
          {sortedReviews.length === 0 ? (
            <EstadoVazio
              icone={Star}
              titulo="Nenhuma review no período"
              descricao="Avalie um jogo e compartilhe sua opinião com a comunidade."
              acao={{ label: 'Escrever review', to: '/m/profile' }}
            />
          ) : sortedReviews.map(r => <ReviewCard key={r.id} r={r} onLike={handleLikeReview} />)}
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedPosts.length === 0 && sortedReviews.length === 0 ? (
            <EstadoVazio icone={MessagesSquare} titulo="Nada por aqui ainda" descricao="Posts e reviews da comunidade aparecerão aqui." />
          ) : (
            [
              ...sortedPosts.map(p => ({ kind: 'post' as const, ts: +new Date(p.created_at), data: p })),
              ...sortedReviews.map(r => ({ kind: 'review' as const, ts: +new Date(r.created_at), data: r })),
            ].sort((a, b) => b.ts - a.ts).slice(0, 40).map(entry =>
              entry.kind === 'post'
                ? <PostCard key={`p-${entry.data.id}`} p={entry.data} onDeleted={() => setPosts(prev => prev.filter(x => x.id !== entry.data.id))} />
                : <ReviewCard key={`r-${entry.data.id}`} r={entry.data} onLike={handleLikeReview} />
            )
          )}
        </div>
      )}

      {/* GAP-1035: Carregar mais */}
      {!loading && hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
          {loadingMore ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}


      {suggestOpen && (
        <div className="fixed inset-0 z-50 overlay-scrim flex items-end" onClick={() => setSuggestOpen(false)}>
          <div className="w-full bg-card rounded-t-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><Lightbulb className="h-4 w-4 text-accent" />Sugerir jogo</h3>
              <button onClick={() => setSuggestOpen(false)} className="p-1 rounded-lg bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Sua sugestão será revisada por um administrador. Você receberá uma notificação quando for aprovada ou rejeitada.</p>
            <input value={suggestTitle} onChange={e => setSuggestTitle(e.target.value)} placeholder="Nome do jogo (ex: Hollow Knight Silksong)" maxLength={120}
              className="w-full p-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <textarea value={suggestDesc} onChange={e => setSuggestDesc(e.target.value)} placeholder="Por que esse jogo? (opcional)" rows={3} maxLength={500}
              className="w-full p-3 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <button onClick={submitSuggestion} disabled={suggesting || suggestTitle.trim().length < 2}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar sugestão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ p, onDeleted }: { p: ForumPost; onDeleted?: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canDelete = !!user && user.id === p.user_id;
  const canReport = !user || user.id !== p.user_id;
  const handleDelete = async () => {
    if (!user || user.id !== p.user_id) return;
    const { error } = await supabase.from('forum_posts').delete().eq('id', p.id);
    if (error) { toast.error('Não foi possível excluir'); return; }
    toast.success('Post excluído');
    onDeleted?.();
  };
  return (
    <div role="link" tabIndex={0}
      onClick={() => navigate(`/m/forum/post/${p.id}`)}
      onKeyDown={e => { if (e.key === 'Enter') navigate(`/m/forum/post/${p.id}`); }}
      className="block glass rounded-xl p-3 hover:border-primary/40 transition-colors cursor-pointer">
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={e => { e.stopPropagation(); navigate(`/m/forum/${p.product_id}`); }} className="bg-transparent border-0 p-0 cursor-pointer">
          <MForumTag name={p.product.toLowerCase().replace(/\s+/g, '').slice(0, 12)} />
        </button>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{timeAgo(p.created_at)}</span>
          <ItemActionsMenu
            copyText={p.content}
            shareUrl={`/m/forum/post/${p.id}`}
            canDelete={canDelete}
            onDelete={handleDelete}
            deleteConfirm="Excluir este post?"
            reportType={canReport ? 'forum_post' : undefined}
            reportTargetId={p.id}
            reportLabel="post"
            iconClassName="h-3.5 w-3.5"
          />
        </div>
      </div>
      <SpoilerGuard isSpoiler={p.is_spoiler} achievementName={p.spoiler_achievement_name} productId={p.product_id}>
        <p className="text-sm text-foreground line-clamp-3">{p.content}</p>
      </SpoilerGuard>
      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
        <span>por <b className="text-foreground">{p.author}</b></span>
        <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{p.likes_count}</span>
        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{p.replies_count}</span>
      </div>
    </div>
  );
}

function ReviewCard({ r, onLike }: { r: ForumReview; onLike: (id: string) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div className="block glass rounded-xl p-3 hover:border-accent/40 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={e => { e.stopPropagation(); navigate(`/m/forum/${r.product_id}`); }} className="bg-transparent border-0 p-0 cursor-pointer">
          <MForumTag name={r.product.toLowerCase().replace(/\s+/g, '').slice(0, 12)} />
        </button>
        <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_at)}</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <HalfStarDisplay rating={r.rating} size={13} />
        <span className="text-xs font-bold text-price">{r.rating.toFixed(1)}</span>
      </div>
      {r.comment && (
        <SpoilerGuard isSpoiler={r.is_spoiler} achievementName={r.spoiler_achievement_name} productId={r.product_id}>
          <p className="text-sm text-foreground line-clamp-3">{r.comment}</p>
        </SpoilerGuard>
      )}
      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
        <span>por <b className="text-foreground">{r.author}</b></span>
        {/* GAP-1037: Curtir review */}
        <button 
          onClick={(e) => { e.stopPropagation(); onLike(r.id); }} 
          className={`flex items-center gap-1 transition-colors ${r.user_liked ? 'text-primary' : 'hover:text-primary'}`}
        >
          <ThumbsUp className={`h-3 w-3 ${r.user_liked ? 'fill-primary' : ''}`} />
          {r.likes}
        </button>
      </div>
    </div>
  );
}