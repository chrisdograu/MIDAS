import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, ThumbsUp, ThumbsDown, MessageSquare, BookMarked, Check, Gamepad2, ShoppingBag, Edit2, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MForumTag, MobileChip } from '@/mobile/lib/badge';
import { timeAgo, periodSince, type Period, PERIOD_OPTIONS } from '@/mobile/lib/time';
import { HalfStarDisplay, InteractiveHalfStar } from '@/components/HalfStarRating';
import LevelBadge from '@/components/LevelBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import SpoilerGuard from '@/components/spoiler/SpoilerGuard';
import SpoilerComposerControls from '@/components/spoiler/SpoilerComposerControls';
import EstadoVazio from '@/components/EstadoVazio';
import ErroCarregamento from '@/components/ErroCarregamento';
import { MessageSquare as MessageSquareIcon } from 'lucide-react';
import DataSaverImage from '@/components/DataSaverImage';
import { toggleLike } from '@/lib/toggleLike';
import { dbWrite } from '@/lib/dbWrite';

interface Game { id: string; title: string; image_url: string | null; description: string | null; rating: number | null }
interface Post { id: string; content: string; created_at: string; likes_count: number; user_id: string; replies: number; author: string; iLiked: boolean; is_spoiler: boolean; spoiler_achievement_name: string | null; edited_at?: string | null; is_editing?: boolean; edit_content?: string; }
interface Review { id: string; rating: number; comment: string | null; created_at: string; user_id: string; author: string; likes: number; dislikes: number; myReaction: 'like' | 'dislike' | null; is_spoiler: boolean; spoiler_achievement_name: string | null; edited_at?: string | null; is_editing?: boolean; edit_rating?: number; edit_comment?: string; }

type Sort = 'popular' | 'recent';

// GAP-1044: Constante de limite
const LIMIT = 20;

export default function MForumGame() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [gameLoading, setGameLoading] = useState(true);
  const [tab, setTab] = useState<'forum' | 'reviews' | 'both'>('both');
  const [posts, setPosts] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [postOpen, setPostOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [postSpoiler, setPostSpoiler] = useState(false);
  const [postAchievement, setPostAchievement] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSpoiler, setReviewSpoiler] = useState(false);
  const [reviewAchievement, setReviewAchievement] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('popular');
  const [period, setPeriod] = useState<Period>('all');
  const [libStatus, setLibStatus] = useState<'none' | 'quero_jogar' | 'ja_joguei'>('none');
  const [gameError, setGameError] = useState(false);
  const [postSending, setPostSending] = useState(false);
  const [reviewSending, setReviewSending] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadGame = () => {
    if (!gameId) { setGameLoading(false); return; }
    setGameLoading(true);
    setGameError(false);
    supabase.from('produtos').select('id, title, image_url, description, rating').eq('id', gameId).maybeSingle()
      .then(({ data, error }) => {
        if (error) setGameError(true);
        setGame(data as Game);
        setGameLoading(false);
      });
  };
  useEffect(() => { loadGame(); }, [gameId]);

  useEffect(() => {
    if (!user || !gameId) { setLibStatus('none'); return; }
    supabase.from('biblioteca_usuario').select('status').eq('user_id', user.id).eq('product_id', gameId).maybeSingle()
      .then(({ data }) => setLibStatus((data?.status as any) || 'none'));
  }, [user?.id, gameId]);

  const setLibrary = async (status: 'quero_jogar' | 'ja_joguei') => {
    if (!user) { toast.error('Entre para usar a biblioteca'); navigate('/m/auth'); return; }
    if (!gameId) return;
    const { error } = await supabase.from('biblioteca_usuario')
      .upsert({ user_id: user.id, product_id: gameId, status }, { onConflict: 'user_id,product_id' });
    if (error) { toast.error('Erro ao atualizar biblioteca'); return; }
    setLibStatus(status);
    toast.success(status === 'ja_joguei' ? '🎮 Marcado como já joguei' : '⭐ Adicionado a "quero jogar"');
  };

  // GAP-1046: Editar post
  const editPost = async (postId: string, content: string) => {
    if (!user) return;
    if (!content.trim()) { toast.error('Conteúdo não pode ficar vazio'); return; }
    const { error } = await supabase
      .from('forum_posts')
      .update({ content: content.trim(), edited_at: new Date().toISOString() })
      .eq('id', postId);
    if (error) { toast.error('Erro ao editar'); return; }
    setPosts(prev => prev.map(p => 
      p.id === postId 
        ? { ...p, content: content.trim(), edited_at: new Date().toISOString(), is_editing: false }
        : p
    ));
    toast.success('Post editado');
  };

  // GAP-1046: Editar review
  const editReview = async (reviewId: string, rating: number, comment: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('avaliacoes')
      .update({ rating, comment: comment.trim() || null, edited_at: new Date().toISOString() })
      .eq('id', reviewId);
    if (error) { toast.error('Erro ao editar review'); return; }
    setReviews(prev => prev.map(r => 
      r.id === reviewId 
        ? { ...r, rating, comment: comment.trim() || null, edited_at: new Date().toISOString(), is_editing: false }
        : r
    ));
    toast.success('Review editada');
  };

  // GAP-1045: Notificação de resposta
  const notifyPostOwner = async (postId: string, postUserId: string, content: string) => {
    if (!user || user.id === postUserId) return;
    await dbWrite(
      supabase.from('notifications').insert({
        user_id: postUserId,
        type: 'forum_reply',
        title: `${(user as any).display_name || 'Alguém'} respondeu seu post no fórum`,
        body: content.slice(0, 100),
        reference_type: 'forum_post',
        reference_id: postId,
      })
    );
  };

  const loadFeed = async (reset: boolean = true) => {
    if (!gameId) { setFeedLoading(false); return; }
    if (reset) {
      setFeedLoading(true);
      setPage(0);
      setHasMore(true);
    } else {
      setFeedLoadingMore(true);
    }
    
    const currentPage = reset ? 0 : page;
    const offset = currentPage * LIMIT;
    const since = periodSince(period);
    const sinceISO = since ? since.toISOString() : '1970-01-01';

    const [{ data: ps }, { data: rs }] = await Promise.all([
      supabase.from('forum_posts').select('id, content, created_at, likes_count, user_id, product_id, is_spoiler, spoiler_achievement_name, edited_at').eq('product_id', gameId).gte('created_at', sinceISO).order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1),
      supabase.from('avaliacoes').select('id, rating, comment, created_at, user_id, is_spoiler, spoiler_achievement_name, edited_at').eq('product_id', gameId).eq('is_approved', true).gte('created_at', sinceISO).order('created_at', { ascending: false }).range(offset, offset + LIMIT - 1),
    ]);

    const userIds = new Set<string>();
    ps?.forEach(p => userIds.add(p.user_id));
    rs?.forEach(r => userIds.add(r.user_id));
    const pIds = ps?.map(p => p.id) || [];
    const rIds = rs?.map(r => r.id) || [];
    const [{ data: profiles }, { data: replies }, { data: likes }, { data: postLikes }, { data: dislikes }] = await Promise.all([
      userIds.size ? supabase.from('profiles').select('id, display_name').in('id', [...userIds]) : Promise.resolve({ data: [] }),
      pIds.length ? supabase.from('forum_replies').select('post_id').in('post_id', pIds) : Promise.resolve({ data: [] }),
      rIds.length ? supabase.from('review_likes').select('review_id, user_id').in('review_id', rIds) : Promise.resolve({ data: [] }),
      pIds.length ? supabase.from('forum_post_likes').select('post_id, user_id').in('post_id', pIds) : Promise.resolve({ data: [] }),
      rIds.length ? supabase.from('review_comments').select('review_id, user_id, content').in('review_id', rIds).eq('content', '__dislike__') : Promise.resolve({ data: [] }),
    ]);
    const pm = new Map((profiles || []).map((p: any) => [p.id, p.display_name || 'Usuário']));
    const rc = new Map<string, number>(); (replies || []).forEach((r: any) => rc.set(r.post_id, (rc.get(r.post_id) || 0) + 1));
    const likesMap = new Map<string, Set<string>>();
    (likes || []).forEach((l: any) => {
      if (!likesMap.has(l.review_id)) likesMap.set(l.review_id, new Set());
      likesMap.get(l.review_id)!.add(l.user_id);
    });
    const disMap = new Map<string, Set<string>>();
    (dislikes || []).forEach((d: any) => {
      if (!disMap.has(d.review_id)) disMap.set(d.review_id, new Set());
      disMap.get(d.review_id)!.add(d.user_id);
    });
    const postLikedSet = new Set<string>();
    (postLikes || []).forEach((l: any) => { if (user && l.user_id === user.id) postLikedSet.add(l.post_id); });

    const newPosts = (ps || []).map((p: any) => ({
      id: p.id, content: p.content, created_at: p.created_at || '',
      likes_count: p.likes_count, user_id: p.user_id,
      replies: rc.get(p.id) || 0, author: pm.get(p.user_id) || 'Usuário',
      iLiked: postLikedSet.has(p.id),
      is_spoiler: !!p.is_spoiler, spoiler_achievement_name: p.spoiler_achievement_name || null,
      edited_at: p.edited_at || null,
    }));
    const newReviews = (rs || []).map((r: any) => {
      const likeSet = likesMap.get(r.id) || new Set();
      const disSet = disMap.get(r.id) || new Set();
      const myReaction: 'like' | 'dislike' | null = user
        ? likeSet.has(user.id) ? 'like' : disSet.has(user.id) ? 'dislike' : null
        : null;
      return {
        id: r.id, rating: Number(r.rating), comment: r.comment, created_at: r.created_at,
        user_id: r.user_id, author: pm.get(r.user_id) || 'Usuário',
        likes: likeSet.size, dislikes: disSet.size, myReaction,
        is_spoiler: !!r.is_spoiler, spoiler_achievement_name: r.spoiler_achievement_name || null,
        edited_at: r.edited_at || null,
      };
    });

    if (reset) {
      setPosts(newPosts);
      setReviews(newReviews);
    } else {
      setPosts(prev => [...prev, ...newPosts]);
      setReviews(prev => [...prev, ...newReviews]);
    }
    setHasMore((ps?.length || 0) >= LIMIT || (rs?.length || 0) >= LIMIT);
    setPage(currentPage + 1);
    setFeedLoading(false);
    setFeedLoadingMore(false);
  };

  useEffect(() => { loadFeed(true); }, [gameId, user?.id, period]);

  const filteredPosts = useMemo(() => {
    const since = periodSince(period);
    let arr = posts.filter(p => !since || new Date(p.created_at) >= since);
    if (sort === 'popular') arr = [...arr].sort((a, b) => (b.likes_count + b.replies * 2) - (a.likes_count + a.replies * 2));
    else arr = [...arr].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return arr;
  }, [posts, sort, period]);

  const filteredReviews = useMemo(() => {
    const since = periodSince(period);
    let arr = reviews.filter(r => !since || new Date(r.created_at) >= since);
    if (sort === 'popular') arr = [...arr].sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
    else arr = [...arr].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return arr;
  }, [reviews, sort, period]);

  const submitPost = async () => {
    if (!user || !postText.trim() || !gameId || postSending) return;
    setPostSending(true);
    const { error } = await supabase.from('forum_posts').insert({
      user_id: user.id, product_id: gameId, content: postText.trim().slice(0, 2000),
      is_spoiler: postSpoiler,
      spoiler_achievement_name: postAchievement,
    } as any);
    setPostSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Post criado'); setPostOpen(false); setPostText(''); setPostSpoiler(false); setPostAchievement(null); loadFeed(true);
  };
  
  const submitReview = async () => {
    if (!user || !gameId) return;
    const existing = reviews.find(r => r.user_id === user.id);
    const payload = {
      user_id: user.id, product_id: gameId, rating: reviewRating,
      comment: reviewText.trim().slice(0, 1000) || null,
      is_spoiler: reviewSpoiler,
      spoiler_achievement_name: reviewAchievement,
    } as any;
    if (reviewSending) return;
    setReviewSending(true);
    const { error } = existing
      ? await supabase.from('avaliacoes').update(payload).eq('id', existing.id)
      : await supabase.from('avaliacoes').insert(payload);
    setReviewSending(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from('biblioteca_usuario')
      .upsert({ user_id: user.id, product_id: gameId, status: 'ja_joguei' }, { onConflict: 'user_id,product_id' });
    setLibStatus('ja_joguei');
    toast.success(existing ? 'Review atualizada' : 'Review publicada — adicionada como "já joguei"');
    setReviewOpen(false); setReviewText(''); setReviewSpoiler(false); setReviewAchievement(null); loadFeed(true);
  };

  const togglePostLike = async (post: Post) => {
    if (!user) { toast.error('Entre para curtir'); return; }
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, iLiked: !p.iLiked, likes_count: p.likes_count + (p.iLiked ? -1 : 1) } : p));
    const res = await toggleLike('forum_post', post.id);
    if (!res) { toast.error('Não foi possível curtir'); loadFeed(true); return; }
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, iLiked: res.liked, likes_count: res.total } : p));
  };

  const reactReview = async (review: Review, kind: 'like' | 'dislike') => {
    if (!user) { toast.error('Entre para reagir'); return; }
    setReviews(prev => prev.map(r => {
      if (r.id !== review.id) return r;
      const wasLike = r.myReaction === 'like';
      const wasDis = r.myReaction === 'dislike';
      let likes = r.likes, dislikes = r.dislikes;
      let myReaction: 'like' | 'dislike' | null = kind;
      if (kind === 'like') {
        if (wasLike) { likes--; myReaction = null; } else { likes++; if (wasDis) dislikes--; }
      } else {
        if (wasDis) { dislikes--; myReaction = null; } else { dislikes++; if (wasLike) likes--; }
      }
      return { ...r, likes, dislikes, myReaction };
    }));
    try {
      if (kind === 'like') {
        await supabase.from('review_comments').delete().eq('review_id', review.id).eq('user_id', user.id).eq('content', '__dislike__');
        if (!(await toggleLike('review', review.id))) throw new Error('curtida');
      } else {
        await supabase.from('review_likes').delete().eq('review_id', review.id).eq('user_id', user.id);
        if (review.myReaction === 'dislike') {
          await supabase.from('review_comments').delete().eq('review_id', review.id).eq('user_id', user.id).eq('content', '__dislike__');
        } else {
          await supabase.from('review_comments').insert({ review_id: review.id, user_id: user.id, content: '__dislike__' });
        }
      }
    } catch {
      toast.error('Não foi possível reagir');
      loadFeed(true);
    }
  };

  if (gameLoading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }
  if (gameError) {
    return <ErroCarregamento titulo="Não foi possível carregar o jogo" onRetry={loadGame} />;
  }
  if (!game) return <div className="p-6 text-center text-muted-foreground">Jogo não encontrado.</div>;

  return (
    <div className="pb-24">
      <div className="px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</button>
        <button
          onClick={() => navigate(`/m/marketplace?q=${encodeURIComponent(game?.title || '')}`)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary text-xs font-semibold text-foreground"
          aria-label="Ver anúncios deste jogo no marketplace"
        >
          <ShoppingBag className="h-3.5 w-3.5" /> Marketplace
        </button>
      </div>

      <div className="px-4">
        <div className="glass rounded-2xl overflow-hidden">
          {game.image_url && <DataSaverImage src={game.image_url} alt={game.title} saverWidth={480} className="w-full aspect-video object-cover" />}
          <div className="p-4">
            <MForumTag name={game.title.toLowerCase().replace(/\s+/g, '').slice(0, 14)} />
            <h1 className="font-display text-xl font-bold mt-1">{game.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <HalfStarDisplay rating={Number(game.rating || 0)} size={14} />
              <span className="text-xs text-muted-foreground">{(game.rating || 0).toString()} média · {posts.length} posts · {reviews.length} reviews</span>
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={() => setLibrary('quero_jogar')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  libStatus === 'quero_jogar' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:border-primary/40'
                }`}>
                {libStatus === 'quero_jogar' ? <Check className="h-3.5 w-3.5" /> : <BookMarked className="h-3.5 w-3.5" />}
                Quero jogar
              </button>
              <button onClick={() => setLibrary('ja_joguei')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  libStatus === 'ja_joguei' ? 'bg-accent text-accent-foreground' : 'bg-card border border-border text-foreground hover:border-accent/40'
                }`}>
                {libStatus === 'ja_joguei' ? <Check className="h-3.5 w-3.5" /> : <Gamepad2 className="h-3.5 w-3.5" />}
                Já joguei
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
        <div className="flex-1 flex p-1 bg-secondary/50 rounded-lg">
          <button onClick={() => setTab('both')} className={`flex-1 py-2 rounded-md text-xs font-semibold ${tab === 'both' ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground' : 'text-muted-foreground'}`}>✨ Ambos</button>
          <button onClick={() => setTab('forum')} className={`flex-1 py-2 rounded-md text-xs font-semibold ${tab === 'forum' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>💬 Fórum</button>
          <button onClick={() => setTab('reviews')} className={`flex-1 py-2 rounded-md text-xs font-semibold ${tab === 'reviews' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>⭐ Reviews</button>
        </div>
          <button onClick={() => setFiltersOpen(true)} aria-label="Abrir filtros" className="relative h-10 w-10 shrink-0 rounded-lg bg-card border border-border flex items-center justify-center"><SlidersHorizontal className="h-4 w-4" />{(sort !== 'popular' || period !== 'all') && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{(sort !== 'popular' ? 1 : 0) + (period !== 'all' ? 1 : 0)}</span>}</button>
        </div>

        {tab === 'reviews' && (
          <Link to={`/m/review/${gameId}`} className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5">
            <Plus className="h-4 w-4" /> Escrever / ver reviews completas
          </Link>
        )}
        {tab === 'forum' && user && (
          <button onClick={() => setPostOpen(true)} className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5">
            <Plus className="h-4 w-4" /> Criar post
          </button>
        )}

        <div className="mt-4 space-y-2.5">
          {feedLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (() => {
            const showPosts = tab !== 'reviews';
            const showReviews = tab !== 'forum';
            const bothMode = tab === 'both';
            const renderPost = (p: Post) => {
              const canEdit = user && user.id === p.user_id && !p.edited_at && 
                (Date.now() - new Date(p.created_at).getTime()) < 5 * 60 * 1000;
              return (
                <div key={`p-${p.id}`} className="glass rounded-xl p-3 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[9px] font-bold">FÓRUM</span>
                      <b className="text-foreground">{p.author}</b>
                      <LevelBadge userId={p.user_id} size="sm" />
                      {p.edited_at && <span className="text-[9px] text-muted-foreground">(editado)</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      {timeAgo(p.created_at)}
                      {canEdit && (
                        <button 
                          onClick={() => setPosts(prev => prev.map(pp => pp.id === p.id ? { ...pp, is_editing: !pp.is_editing, edit_content: pp.content } : pp))}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  </div>
                  {p.is_editing ? (
                    <div className="mt-1.5 space-y-1.5">
                      <textarea 
                        value={p.edit_content || p.content} 
                        onChange={(e) => setPosts(prev => prev.map(pp => pp.id === p.id ? { ...pp, edit_content: e.target.value } : pp))}
                        rows={2}
                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setPosts(prev => prev.map(pp => pp.id === p.id ? { ...pp, is_editing: false } : pp))} className="px-2 py-1 rounded bg-secondary text-xs">Cancelar</button>
                        <button onClick={() => editPost(p.id, p.edit_content || p.content)} className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <SpoilerGuard isSpoiler={p.is_spoiler} achievementName={p.spoiler_achievement_name} productId={gameId} className="mt-1.5">
                      <p className={`text-sm ${bothMode ? 'line-clamp-2' : 'line-clamp-3'}`}>{p.content}</p>
                    </SpoilerGuard>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <button onClick={() => togglePostLike(p)} className={`flex items-center gap-1 hover:text-primary ${p.iLiked ? 'text-primary' : ''}`}>
                      <ThumbsUp className={`h-3 w-3 ${p.iLiked ? 'fill-current' : ''}`} />{p.likes_count}
                    </button>
                    {!bothMode && (
                      <Link to={`/m/forum/post/${p.id}`} className="flex items-center gap-1 hover:text-foreground">
                        <MessageSquare className="h-3 w-3" />{p.replies}
                      </Link>
                    )}
                  </div>
                </div>
              );
            };
            const renderReview = (r: Review) => {
              const canEdit = user && user.id === r.user_id && !r.edited_at && 
                (Date.now() - new Date(r.created_at).getTime()) < 5 * 60 * 1000;
              return (
                <div key={`r-${r.id}`} className="block glass rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[9px] font-bold">REVIEW</span>
                      <span className="text-sm font-semibold">{r.author}</span>
                      <LevelBadge userId={r.user_id} size="sm" />
                      {r.edited_at && <span className="text-[9px] text-muted-foreground">(editado)</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      {timeAgo(r.created_at)}
                      {canEdit && (
                        <button 
                          onClick={() => setReviews(prev => prev.map(rr => rr.id === r.id ? { ...rr, is_editing: !rr.is_editing, edit_rating: rr.rating, edit_comment: rr.comment || '' } : rr))}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  </div>
                  {r.is_editing ? (
                    <div className="space-y-2">
                      <div className="flex justify-center"><InteractiveHalfStar value={r.edit_rating || r.rating} onChange={(val) => setReviews(prev => prev.map(rr => rr.id === r.id ? { ...rr, edit_rating: val } : rr))} /></div>
                      <textarea 
                        value={r.edit_comment !== undefined ? r.edit_comment : r.comment || ''} 
                        onChange={(e) => setReviews(prev => prev.map(rr => rr.id === r.id ? { ...rr, edit_comment: e.target.value } : rr))}
                        rows={2}
                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setReviews(prev => prev.map(rr => rr.id === r.id ? { ...rr, is_editing: false } : rr))} className="px-2 py-1 rounded bg-secondary text-xs">Cancelar</button>
                        <button onClick={() => editReview(r.id, r.edit_rating || r.rating, r.edit_comment || r.comment || '')} className="px-2 py-1 rounded bg-accent text-accent-foreground text-xs">Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1"><HalfStarDisplay rating={r.rating} size={13} /><span className="text-xs font-semibold text-price">{r.rating.toFixed(1)}</span></div>
                      {r.comment && (
                        <SpoilerGuard isSpoiler={r.is_spoiler} achievementName={r.spoiler_achievement_name} productId={gameId}>
                          <p className={`text-sm ${tab === 'both' ? 'line-clamp-2' : ''}`}>{r.comment}</p>
                        </SpoilerGuard>
                      )}
                    </>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <button onClick={(e) => { e.preventDefault(); reactReview(r, 'like'); }} className={`flex items-center gap-1 hover:text-primary ${r.myReaction === 'like' ? 'text-primary' : ''}`}>
                      <ThumbsUp className={`h-3 w-3 ${r.myReaction === 'like' ? 'fill-current' : ''}`} />{r.likes}
                    </button>
                    <button onClick={(e) => { e.preventDefault(); reactReview(r, 'dislike'); }} className={`flex items-center gap-1 hover:text-destructive ${r.myReaction === 'dislike' ? 'text-destructive' : ''}`}>
                      <ThumbsDown className={`h-3 w-3 ${r.myReaction === 'dislike' ? 'fill-current' : ''}`} />{r.dislikes}
                    </button>
                  </div>
                </div>
              );
            };
            const merged = tab === 'forum'
              ? filteredPosts.map(renderPost)
              : tab === 'reviews'
                ? filteredReviews.map(renderReview)
                : [
                    ...filteredPosts.map(item => ({ kind: 'post' as const, date: item.created_at, item })),
                    ...filteredReviews.map(item => ({ kind: 'review' as const, date: item.created_at, item })),
                  ].sort((a, b) => +new Date(b.date) - +new Date(a.date))
                    .map(entry => entry.kind === 'post' ? renderPost(entry.item as Post) : renderReview(entry.item as Review));
            if (!merged.length) return <EstadoVazio icone={MessageSquareIcon} titulo="Nada por aqui no período" descricao="Ajuste os filtros ou seja o primeiro a publicar." />;
            return (
              <>
                {merged}
                {/* GAP-1044: Carregar mais */}
                {hasMore && (
                  <button
                    onClick={() => loadFeed(false)}
                    disabled={feedLoadingMore}
                    className="w-full py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {feedLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                    {feedLoadingMore ? 'Carregando...' : 'Carregar mais'}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {postOpen && (
        <div className="fixed inset-0 z-50 overlay-scrim flex items-end" onClick={() => setPostOpen(false)}>
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold">Criar post em M/{game.title.toLowerCase().replace(/\s+/g, '').slice(0, 12)}</h3>
            <textarea value={postText} onChange={e => setPostText(e.target.value)} maxLength={2000} rows={5} placeholder="Compartilhe algo sobre o jogo..." className="w-full p-3 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <SpoilerComposerControls
              isSpoiler={postSpoiler} onIsSpoilerChange={setPostSpoiler}
              achievementName={postAchievement} onAchievementNameChange={setPostAchievement}
              productId={gameId}
            />
            <div className="flex gap-2">
              <button onClick={() => setPostOpen(false)} disabled={postSending} className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold disabled:opacity-50">Cancelar</button>
              <button onClick={submitPost} disabled={postSending || !postText.trim()} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">{postSending ? 'Publicando...' : 'Publicar'}</button>
            </div>
          </motion.div>
        </div>
      )}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 overlay-scrim flex items-end" onClick={() => setReviewOpen(false)}>
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold">Avaliar {game.title}</h3>
            <div className="flex justify-center"><InteractiveHalfStar value={reviewRating} onChange={setReviewRating} /></div>
            <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} maxLength={1000} rows={4} placeholder="Conte sua experiência (opcional)..." className="w-full p-3 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50" />
            <SpoilerComposerControls
              isSpoiler={reviewSpoiler} onIsSpoilerChange={setReviewSpoiler}
              achievementName={reviewAchievement} onAchievementNameChange={setReviewAchievement}
              productId={gameId}
            />
            <div className="flex gap-2">
              <button onClick={() => setReviewOpen(false)} disabled={reviewSending} className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold disabled:opacity-50">Cancelar</button>
              <button onClick={submitReview} disabled={reviewSending} className="flex-1 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-50">{reviewSending ? 'Publicando...' : 'Publicar review'}</button>
            </div>
          </motion.div>
        </div>
      )}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 overlay-scrim flex items-end" onClick={() => setFiltersOpen(false)}>
          <motion.div initial={{ y: 400 }} animate={{ y: 0 }} className="w-full max-h-[85vh] overflow-y-auto bg-card rounded-t-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Filtros</h3><button onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros"><X className="h-5 w-5" /></button></div>
            <div><p className="text-[10px] uppercase text-muted-foreground">Ordenar por</p><div className="flex flex-wrap gap-2 mt-2"><MobileChip active={sort === 'popular'} onClick={() => setSort('popular')}>Populares</MobileChip><MobileChip active={sort === 'recent'} onClick={() => setSort('recent')}>Recentes</MobileChip></div></div>
            <div><p className="text-[10px] uppercase text-muted-foreground">Período</p><div className="flex flex-wrap gap-2 mt-2">{PERIOD_OPTIONS.map(p => <MobileChip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</MobileChip>)}</div></div>
            <div className="flex gap-2"><button onClick={() => { setSort('popular'); setPeriod('all'); }} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold">Limpar</button><button onClick={() => setFiltersOpen(false)} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Aplicar</button></div>
          </motion.div>
        </div>
      )}
    </div>
  );
}