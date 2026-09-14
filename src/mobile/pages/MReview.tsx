import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ThumbsUp, ThumbsDown, Loader2, Flame, Clock, Calendar, Tag, MessageSquare, Send, Star, Filter, AlertCircle, CheckCircle2 } from 'lucide-react';
import { FilterChip, FilterChipGroup } from '@/components/FilterChip';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { HalfStarDisplay, InteractiveHalfStar } from '@/components/HalfStarRating';
import { MobileBadge } from '@/mobile/lib/badge';
import { timeAgo, periodSince, type Period, PERIOD_OPTIONS } from '@/mobile/lib/time';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { z } from 'zod';
import { ItemActionsMenu } from '@/components/ItemActionsMenu';
import SpoilerGuard from '@/components/spoiler/SpoilerGuard';
import SpoilerComposerControls from '@/components/spoiler/SpoilerComposerControls';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate } from '@/lib/format';
import { toggleLike } from '@/lib/toggleLike';

interface Produto {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  rating: number | null;
  release_date: string | null;
  publisher: string | null;
  platform: string[] | null;
  category: string | null;
  tags: string[] | null;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string;
  author: string;
  avatar: string | null;
  likes: number;
  dislikes: number;
  myReaction: 'like' | 'dislike' | null;
  is_spoiler: boolean;
  spoiler_achievement_name: string | null;
}

type Sort = 'popular' | 'recent' | 'top';
type FilterRating = 'all' | '4+' | '3+';

const reviewSchema = z.object({
  rating: z.number().min(0.5, 'Avalie de 0.5 a 5').max(5),
  comment: z.string().trim().max(2000).optional(),
});

export default function MReview() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  const [produto, setProduto] = useState<Produto | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>('popular');
  const [onlyWithText, setOnlyWithText] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<FilterRating>('all');
  const [period, setPeriod] = useState<Period>('all');

  const [suggestTitle, setSuggestTitle] = useState('');

  // GAP-1106: Verificar posse do jogo (apenas para exibir badge)
  const [ownsGame, setOwnsGame] = useState<boolean | null>(null);

  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [mySpoiler, setMySpoiler] = useState(false);
  const [myAchievement, setMyAchievement] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canDeleteReview = (reviewUserId: string) => !!user && user.id === reviewUserId;
  const canReportReview = (reviewUserId: string) => !user || user.id !== reviewUserId;

  const load = async () => {
    if (!productId) return;
    setLoading(true);

    const { data: prod } = await supabase
      .from('produtos')
      .select('id, title, description, image_url, rating, release_date, publisher, platform, category, tags')
      .eq('id', productId)
      .maybeSingle();

    setProduto(prod as Produto | null);

    // GAP-1106: Verificar se o usuário possui o jogo (apenas para exibir badge)
    if (user && prod) {
      const { data: libEntry } = await supabase
        .from('biblioteca_usuario')
        .select('status')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle();
      
      setOwnsGame(!!libEntry);
    } else if (!user) {
      setOwnsGame(null);
    }

    if (prod) {
      // Inclui reviews aprovadas + a própria review (mesmo pendente)
      const reviewQuery = supabase
        .from('avaliacoes')
        .select('id, rating, comment, created_at, user_id, is_spoiler, spoiler_achievement_name')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      const { data: revs } = user
        ? await reviewQuery.or(`is_approved.eq.true,user_id.eq.${user.id}`)
        : await reviewQuery.eq('is_approved', true);

      const userIds = [...new Set((revs || []).map(r => r.user_id))];
      const reviewIds = (revs || []).map(r => r.id);

      const [{ data: profiles }, { data: likes }] = await Promise.all([
        userIds.length
          ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        reviewIds.length
          ? supabase.from('review_likes').select('review_id, user_id').in('review_id', reviewIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      
      const { data: dislikeMarkers } = reviewIds.length
        ? await supabase
            .from('review_comments')
            .select('review_id, user_id, content')
            .in('review_id', reviewIds)
            .eq('content', '__dislike__')
        : { data: [] as any[] };

      const likesMap = new Map<string, Set<string>>();
      (likes || []).forEach((l: any) => {
        if (!likesMap.has(l.review_id)) likesMap.set(l.review_id, new Set());
        likesMap.get(l.review_id)!.add(l.user_id);
      });
      const dislikesMap = new Map<string, Set<string>>();
      (dislikeMarkers || []).forEach((d: any) => {
        if (!dislikesMap.has(d.review_id)) dislikesMap.set(d.review_id, new Set());
        dislikesMap.get(d.review_id)!.add(d.user_id);
      });

      const items: ReviewItem[] = (revs || []).map((r: any) => {
        const p = profileMap.get(r.user_id);
        const likeSet = likesMap.get(r.id) || new Set();
        const disSet = dislikesMap.get(r.id) || new Set();
        const myReaction: 'like' | 'dislike' | null = user
          ? likeSet.has(user.id) ? 'like' : disSet.has(user.id) ? 'dislike' : null
          : null;
        return {
          id: r.id,
          rating: Number(r.rating),
          comment: r.comment,
          created_at: r.created_at,
          user_id: r.user_id,
          author: p?.display_name || 'Usuário',
          avatar: p?.avatar_url || null,
          likes: likeSet.size,
          dislikes: disSet.size,
          myReaction,
          is_spoiler: !!r.is_spoiler,
          spoiler_achievement_name: r.spoiler_achievement_name || null,
        };
      });

      setReviews(items);
    } else {
      setReviews([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!productId) return;
    const ch = supabase
      .channel(`review-${productId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avaliacoes', filter: `product_id=eq.${productId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review_likes' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [productId, user?.id]);

  useEffect(() => {
    if (!focusId || loading) return;
    const el = document.getElementById(`review-${focusId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, loading, reviews.length]);

  const sortedReviews = useMemo(() => {
    const since = periodSince(period);
    const copy = [...reviews].filter((review) => {
      if (onlyWithText && !review.comment?.trim()) return false;
      if (ratingFilter === '4+' && review.rating < 4) return false;
      if (ratingFilter === '3+' && review.rating < 3) return false;
      if (since && new Date(review.created_at) < since) return false;
      return true;
    });
    if (sort === 'popular') {
      copy.sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes) || +new Date(b.created_at) - +new Date(a.created_at));
    } else if (sort === 'top') {
      copy.sort((a, b) => b.rating - a.rating || b.likes - a.likes);
    } else {
      copy.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return copy;
  }, [reviews, sort, onlyWithText, ratingFilter]);

  const reviewTag = useMemo(() => {
    if (!produto?.title) return '';
    return produto.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }, [produto?.title]);

  const avg = useMemo(() => {
    if (!reviews.length) return Number(produto?.rating || 0);
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews, produto]);

  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    reviews.forEach(r => {
      const idx = Math.min(4, Math.max(0, Math.ceil(r.rating) - 1));
      buckets[idx]++;
    });
    return buckets;
  }, [reviews]);

  const handleReact = async (review: ReviewItem, kind: 'like' | 'dislike') => {
    if (!user) { toast.error('Entre para reagir'); navigate('/m/auth'); return; }

    setReviews(prev => prev.map(r => {
      if (r.id !== review.id) return r;
      const wasLike = r.myReaction === 'like';
      const wasDis = r.myReaction === 'dislike';
      let likes = r.likes, dislikes = r.dislikes;
      let myReaction: 'like' | 'dislike' | null = kind;
      if (kind === 'like') {
        if (wasLike) { likes--; myReaction = null; }
        else { likes++; if (wasDis) dislikes--; }
      } else {
        if (wasDis) { dislikes--; myReaction = null; }
        else { dislikes++; if (wasLike) likes--; }
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
    } catch (e: any) {
      toast.error('Não foi possível registrar sua reação');
      load();
    }
  };

  // Preenche myRating/myComment com review existente quando carrega
  useEffect(() => {
    if (!user) return;
    const mine = reviews.find(r => r.user_id === user.id);
    if (mine) {
      setMyRating(mine.rating);
      setMyComment(mine.comment || '');
      setMySpoiler(mine.is_spoiler);
      setMyAchievement(mine.spoiler_achievement_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, reviews.length]);

  const submitReview = async () => {
    if (!user) { toast.error('Entre para avaliar'); navigate('/m/auth'); return; }
    if (!productId) return;
    
    const parsed = reviewSchema.safeParse({ rating: myRating, comment: myComment });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }

    setSubmitting(true);
    const existing = reviews.find(r => r.user_id === user.id);
    const payload = {
      product_id: productId, user_id: user.id, rating: myRating,
      comment: myComment.trim() || null,
      is_spoiler: mySpoiler,
      spoiler_achievement_name: myAchievement,
    } as any;
    const { error } = existing
      ? await supabase.from('avaliacoes').update(payload).eq('id', existing.id)
      : await supabase.from('avaliacoes').insert(payload);
    setSubmitting(false);

    if (error) { toast.error(error.message); return; }
    
    toast.success(existing ? '✏️ Review atualizada' : '⭐ Review publicada');
    // Não reseta myRating (deixa o valor pra edição), mas limpa spoiler/achievement
    setMySpoiler(false); setMyAchievement(null);
    load();
  };

  const deleteReview = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('avaliacoes').delete().eq('id', id).eq('user_id', user.id);
    if (error) { toast.error('Não foi possível excluir'); return; }
    toast.success('Review excluída');
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  const submitSuggestion = async () => {
    if (!user) { toast.error('Entre para sugerir'); navigate('/m/auth'); return; }
    const title = suggestTitle.trim();
    if (title.length < 2) { toast.error('Título muito curto'); return; }
    const { error } = await supabase.from('game_suggestions').insert({
      requested_by: user.id,
      title,
    });
    if (error) { toast.error('Erro ao enviar sugestão'); return; }
    toast.success('🎮 Sugestão enviada para revisão da equipe!');
    setSuggestTitle('');
  };

  if (loading) {
    return (
      <div className="px-4 py-5 space-y-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="px-4 py-5 space-y-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 text-center">
          <Flame className="h-10 w-10 text-primary mx-auto mb-2" />
          <h2 className="font-display text-xl font-bold gradient-text">Jogo não encontrado</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Esse jogo ainda não está no nosso catálogo. Sugira um título e nossa equipe avalia adicionar.
          </p>
          <div className="flex gap-2">
            <input
              value={suggestTitle}
              onChange={e => setSuggestTitle(e.target.value)}
              placeholder="Nome do jogo (ex: Hollow Knight Silksong)"
              className="flex-1 px-3 py-2.5 bg-background/60 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={submitSuggestion}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm flex items-center gap-1.5"
            >
              <Send className="h-4 w-4" /> Sugerir
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="relative">
        {produto.image_url && (
          <div className="absolute inset-0 h-56 overflow-hidden">
            <img src={produto.image_url} alt="" className="w-full h-full object-cover blur-2xl opacity-30 scale-110" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
          </div>
        )}

        <div className="relative px-4 pt-4 pb-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>

          <div className="flex gap-3">
            <div className="w-24 h-32 rounded-xl overflow-hidden bg-card border border-border/50 shrink-0 shadow-2xl">
              {produto.image_url
                ? <img src={produto.image_url} alt={produto.title} className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full flex items-center justify-center"><Flame className="h-8 w-8 text-muted-foreground" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl font-bold gradient-text leading-tight line-clamp-2">{produto.title}</h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <HalfStarDisplay rating={avg} size={14} />
                <span className="text-sm font-bold text-foreground">{avg.toFixed(1)}</span>
                <span className="text-[11px] text-muted-foreground">({reviews.length})</span>
              </div>
              {produto.publisher && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Tag className="h-3 w-3" />{produto.publisher}</p>}
              {produto.release_date && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3" />
                  {formatDate(produto.release_date)}
                </p>
              )}
              {!!produto.platform?.length && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {produto.platform.slice(0, 4).map(p => <MobileBadge key={p} tone="primary">{p}</MobileBadge>)}
                </div>
              )}
            </div>
          </div>

          {produto.description && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{produto.description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {produto && (
              <Link to={`/jogo/${produto.id}`} className="text-xs font-semibold text-primary hover:underline">
                Ver na loja →
              </Link>
            )}
            <Link to={`/m/forum/${produto.id}`} className="text-xs font-semibold text-primary hover:underline">
              Ver no fórum →
            </Link>
            <Link to={`/m/marketplace?tag=${encodeURIComponent(reviewTag || produto.title)}`} className="text-xs font-semibold text-accent hover:underline">
              Ver no Marketplace →
            </Link>
          </div>
        </div>
      </div>

      {/* GAP-1106: Badge de posse (apenas informativo) */}
      {user && (
        <div className="px-4 mt-2">
          {ownsGame ? (
            <div className="flex items-center gap-2 text-xs text-success bg-success/10 px-3 py-1.5 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" /> Você possui este jogo na sua biblioteca.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 px-3 py-1.5 rounded-full">
              <AlertCircle className="h-3.5 w-3.5" /> Adquira este jogo para ter a badge "possui" no seu perfil.
            </div>
          )}
        </div>
      )}

      <section className="px-4 mt-4">
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Distribuição</span>
            <span className="text-[10px] text-muted-foreground">{reviews.length} reviews</span>
          </div>
          <div className="flex items-end gap-1 h-16">
            {distribution.map((count, i) => {
              const max = Math.max(1, ...distribution);
              const h = Math.round((count / max) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-muted rounded-t-md relative" style={{ height: `${h}%`, minHeight: count ? '4px' : '2px' }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-primary to-accent rounded-t-md opacity-80" />
                  </div>
                  <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                    {i + 1}<Star className="h-2 w-2 fill-current" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 mt-4">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4">
          <h3 className="text-sm font-bold mb-2">{user ? 'Sua avaliação' : 'Entre para avaliar'}</h3>
          <div className="flex items-center justify-between gap-3 mb-2">
            <InteractiveHalfStar value={myRating} onChange={setMyRating} size={26} />
            <span className="text-sm font-bold text-foreground">{myRating ? myRating.toFixed(1) : '—'}</span>
          </div>
          <textarea
            value={myComment}
            onChange={e => setMyComment(e.target.value)}
            placeholder="Conte o que achou (opcional)..."
            rows={3}
            className="w-full px-3 py-2 bg-background/60 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          {user && (
            <div className="mt-2">
              <SpoilerComposerControls
                isSpoiler={mySpoiler} onIsSpoilerChange={setMySpoiler}
                achievementName={myAchievement} onAchievementNameChange={setMyAchievement}
                productId={productId}
              />
            </div>
          )}
          <div className="flex justify-end mt-2">
            <button
              onClick={submitReview}
              disabled={submitting || myRating === 0}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" /> Publicar
            </button>
          </div>
        </motion.div>
      </section>

      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-primary" /> Reviews da comunidade</h3>
          <div className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-secondary/60 border border-border rounded-full px-2 py-0.5">
            <Filter className="h-3 w-3" /> {sortedReviews.length} visíveis
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-2.5 mb-3 space-y-2">
          <FilterChipGroup label="Ordem">
            {([
              { id: 'popular', label: 'Populares', icon: Flame },
              { id: 'top', label: 'Melhores', icon: Star },
              { id: 'recent', label: 'Recentes', icon: Clock },
            ] as { id: Sort; label: string; icon: typeof Flame }[]).map(s => (
              <FilterChip key={s.id} icon={s.icon} active={sort === s.id} onClick={() => setSort(s.id)}>
                {s.label}
              </FilterChip>
            ))}
          </FilterChipGroup>

          <div className="h-px bg-border/70" />

          <FilterChipGroup label="Nota">
            {([
              { id: 'all', label: 'Todas' },
              { id: '4+', label: '4★+' },
              { id: '3+', label: '3★+' },
            ] as { id: FilterRating; label: string }[]).map(option => (
              <FilterChip key={option.id} tone="accent" active={ratingFilter === option.id} onClick={() => setRatingFilter(option.id)}>
                {option.label}
              </FilterChip>
            ))}
            <FilterChip tone="accent" active={onlyWithText} onClick={() => setOnlyWithText(v => !v)}>
              Com texto
            </FilterChip>
          </FilterChipGroup>

          <div className="h-px bg-border/70" />

          <FilterChipGroup label="Período">
            {PERIOD_OPTIONS.map(p => (
              <FilterChip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>
                {p.label}
              </FilterChip>
            ))}
          </FilterChipGroup>
        </div>

        {sortedReviews.length === 0 ? (
          <EstadoVazio icone={Star} titulo="Seja o primeiro a avaliar" descricao="Compartilhe sua opinião sobre este jogo com a comunidade." />
        ) : (
          <div className="space-y-3">
            {sortedReviews.map((r, idx) => (
              <motion.article
                key={r.id}
                id={`review-${r.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.2) }}
                className={`glass rounded-xl p-4 ${focusId === r.id ? 'ring-2 ring-primary glow-primary' : ''}`}
              >
                <header className="flex items-center gap-2 mb-2">
                  <Link to={`/m/perfil/${r.user_id}`} className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover" loading="lazy" /> : r.author[0]?.toUpperCase()}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/m/perfil/${r.user_id}`} className="text-sm font-semibold truncate hover:text-primary">{r.author}</Link>
                    <div className="flex items-center gap-1.5">
                      <HalfStarDisplay rating={r.rating} size={11} />
                      <span className="text-[10px] text-muted-foreground">• {timeAgo(r.created_at)}</span>
                    </div>
                  </div>
                  <ItemActionsMenu
                    copyText={r.comment || ''}
                    shareUrl={`/m/review/${productId}?focus=${r.id}`}
                    canDelete={canDeleteReview(r.user_id)}
                    onDelete={() => deleteReview(r.id)}
                    deleteConfirm="Excluir esta review?"
                    reportType={canReportReview(r.user_id) ? 'review' : undefined}
                    reportTargetId={r.id}
                    reportLabel="review"
                  />
                </header>
                {r.comment && (
                  <SpoilerGuard isSpoiler={r.is_spoiler} achievementName={r.spoiler_achievement_name} productId={productId}>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{r.comment}</p>
                  </SpoilerGuard>
                )}
                <footer className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleReact(r, 'like')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      r.myReaction === 'like' ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ThumbsUp className="h-3 w-3" /> {r.likes}
                  </button>
                  <button
                    onClick={() => handleReact(r, 'dislike')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      r.myReaction === 'dislike' ? 'bg-destructive/20 text-destructive border border-destructive/40' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ThumbsDown className="h-3 w-3" /> {r.dislikes}
                  </button>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Popularidade: <b className="text-foreground">{r.likes - r.dislikes}</b>
                  </span>
                </footer>
              </motion.article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}