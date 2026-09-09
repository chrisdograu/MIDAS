import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProduto } from '@/hooks/useProdutos';
import { useAuth } from '@/hooks/useAuth';
import { useMutualFriends } from '@/hooks/useFriendActivity';
import { HalfStarDisplay } from '@/components/HalfStarRating';
import {
  ArrowLeft, Users, Library, Star, MessageSquare, Film, Lock, Loader2, Clock,
  Image as ImageIcon, BookOpen, History, Sparkles, TrendingUp, Heart, Filter,
  ThumbsUp, Laugh, Smile, Sad, Angry,
} from 'lucide-react';
import { motion } from 'framer-motion';
import MediaLightbox, { LightboxItem } from '@/components/social/MediaLightbox';
import ReviewCompletaCard, { ReviewCompletaData } from '@/components/social/ReviewCompletaCard';
import SpoilerGuard from '@/components/spoiler/SpoilerGuard';
import { Pencil } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate, formatDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';

type Tab = 'biblioteca' | 'reviews' | 'reviewsCompletas' | 'screenshots' | 'discussoes' | 'historico';
type SortKey = 'recent' | 'liked' | 'trending' | 'close';

// GAP-506: Tipos de reação
type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';

const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  laugh: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡',
};

const REACTION_ICONS: Record<ReactionType, any> = {
  like: ThumbsUp,
  love: Heart,
  laugh: Laugh,
  wow: Smile,
  sad: Sad,
  angry: Angry,
};

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'biblioteca', label: 'Biblioteca', icon: Library },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'reviewsCompletas', label: 'Reviews Completas', icon: BookOpen },
  { id: 'screenshots', label: 'Screenshots', icon: ImageIcon },
  { id: 'discussoes', label: 'Discussões', icon: MessageSquare },
  { id: 'historico', label: 'Histórico', icon: History },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ja_joguei: { label: 'Já jogou', color: 'text-success' },
  jogando: { label: 'Jogando', color: 'text-primary' },
  zerado: { label: 'Zerado', color: 'text-warning' },
  pausado: { label: 'Pausado', color: 'text-muted-foreground' },
  abandonado: { label: 'Abandonou', color: 'text-destructive' },
  quero_jogar: { label: 'Quer jogar', color: 'text-accent' },
  favoritos: { label: 'Favorito', color: 'text-price' },
};

// GAP-506: Componente de reações
function ReactionSelector({ 
  postId, 
  onReact,
  reactions,
  userReaction,
  isReacting,
}: { 
  postId: string;
  onReact: (type: ReactionType) => void;
  reactions: Record<ReactionType, number>;
  userReaction: ReactionType | null;
  isReacting: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  
  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
  const hasReactions = totalReactions > 0;
  
  return (
    <div className="relative inline-flex items-center gap-0.5 flex-wrap">
      {/* Mostrar reações existentes */}
      {hasReactions && (
        <div className="flex items-center gap-0.5 mr-1">
          {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => {
            const count = reactions[type as ReactionType] || 0;
            if (count === 0) return null;
            const isActive = userReaction === type;
            return (
              <button
                key={type}
                onClick={() => onReact(type as ReactionType)}
                disabled={isReacting}
                className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                  isActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'
                } disabled:opacity-50`}
              >
                {emoji} {count}
              </button>
            );
          })}
        </div>
      )}
      
      {/* Botão para adicionar reação */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        disabled={isReacting}
        className="text-xs px-1.5 py-0.5 rounded-full border border-border hover:border-primary/30 transition-colors disabled:opacity-50"
      >
        {userReaction ? '✏️' : '+'}
      </button>
      
      {/* Picker de emojis */}
      {showPicker && (
        <div className="absolute bottom-full left-0 mb-1 p-1.5 bg-card border border-border rounded-lg shadow-lg flex gap-0.5 z-10">
          {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => {
            const Icon = REACTION_ICONS[type as ReactionType];
            const isActive = userReaction === type;
            return (
              <button
                key={type}
                onClick={() => {
                  onReact(type as ReactionType);
                  setShowPicker(false);
                }}
                className={`p-1.5 rounded transition-colors hover:bg-secondary ${
                  isActive ? 'bg-primary/10 border border-primary/30' : ''
                }`}
                title={type}
              >
                <span className="text-lg">{emoji}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// GAP-506: Hook para gerenciar reações
function useReactions(postId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['post-reactions', postId],
    queryFn: async () => {
      const { data } = await supabase
        .from('post_reactions')
        .select('type, user_id')
        .eq('post_id', postId);
      
      const counts: Record<ReactionType, number> = { 
        like: 0, love: 0, laugh: 0, wow: 0, sad: 0, angry: 0 
      };
      let userReaction: ReactionType | null = null;
      
      (data || []).forEach((r: any) => {
        if (r.type in counts) {
          counts[r.type as ReactionType] = (counts[r.type as ReactionType] || 0) + 1;
        }
        if (r.user_id === user?.id) {
          userReaction = r.type as ReactionType;
        }
      });
      
      return { counts, userReaction };
    },
    enabled: !!postId,
    staleTime: 30_000,
  });

  const react = useMutation({
    mutationFn: async (type: ReactionType) => {
      if (!user) { 
        toast.error('Faça login para reagir'); 
        return; 
      }
      
      // Se já reagiu com este tipo, remove
      if (data?.userReaction === type) {
        await dbWrite(
          supabase
            .from('post_reactions')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .eq('type', type)
        );
      } else {
        // Se reagiu com outro tipo, troca
        if (data?.userReaction) {
          await dbWrite(
            supabase
              .from('post_reactions')
              .delete()
              .eq('post_id', postId)
              .eq('user_id', user.id)
          );
        }
        await dbWrite(
          supabase
            .from('post_reactions')
            .insert({ post_id: postId, user_id: user.id, type })
        );
      }
      
      queryClient.invalidateQueries({ queryKey: ['post-reactions', postId] });
    },
  });

  return { 
    reactions: data?.counts || { like: 0, love: 0, laugh: 0, wow: 0, sad: 0, angry: 0 },
    userReaction: data?.userReaction || null,
    react: react.mutate, 
    isReacting: react.isPending,
    isLoading,
  };
}

export default function GameSocialHub() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: game, isLoading } = useProduto(id);
  const { data: friendIds = [], isLoading: loadingFriends } = useMutualFriends();
  const hasFriends = friendIds.length > 0;

  const [tab, setTab] = useState<Tab>('biblioteca');
  const [sort, setSort] = useState<SortKey>('recent');
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  
  // GAP-507: Filtro "apenas amigos próximos"
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);

  // GAP-504: Contagem de novidades por tab
  const [newActivityCounts, setNewActivityCounts] = useState<Record<Tab, number>>({
    biblioteca: 0,
    reviews: 0,
    reviewsCompletas: 0,
    screenshots: 0,
    discussoes: 0,
    historico: 0,
  });

  // Close friends of current viewer
  const { data: closeFriendIds = [] } = useQuery({
    queryKey: ['close-friends-mine', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('close_friends' as any)
        .select('friend_id').eq('user_id', user!.id);
      return ((data as any[]) || []).map(r => r.friend_id as string);
    },
  });

  // GAP-507: Filtrar amigos por close friends
  const filteredFriendIds = useMemo(() => {
    if (!closeFriendsOnly) return friendIds;
    return friendIds.filter(id => closeFriendIds.includes(id));
  }, [friendIds, closeFriendIds, closeFriendsOnly]);

  const { data: library = [] } = useQuery({
    queryKey: ['gsh-library', id, filteredFriendIds],
    enabled: !!id && filteredFriendIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('biblioteca_usuario')
        .select('id,user_id,status,status_updated_at,profile:user_id(display_name,avatar_url)')
        .eq('product_id', id).in('user_id', filteredFriendIds);
      return (data as any[]) || [];
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['gsh-reviews', id, filteredFriendIds],
    enabled: !!id && filteredFriendIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('avaliacoes')
        .select('id,user_id,rating,comment,created_at,profile:user_id(display_name,avatar_url)')
        .eq('product_id', id).in('user_id', filteredFriendIds)
        .order('created_at', { ascending: false });
      const ids = (data as any[] || []).map(r => r.id);
      const { data: meta } = ids.length
        ? await supabase.from('review_metadata' as any).select('*').in('review_id', ids)
        : { data: [] as any[] };
      const metaMap = new Map((meta as any[] || []).map(m => [m.review_id, m]));
      const { data: shots } = ids.length
        ? await supabase.from('review_screenshots' as any).select('*').in('review_id', ids)
        : { data: [] as any[] };
      const shotsMap = new Map<string, any[]>();
      (shots as any[] || []).forEach(s => {
        const arr = shotsMap.get(s.review_id) || [];
        arr.push(s); shotsMap.set(s.review_id, arr);
      });
      return (data as any[] || []).map(r => ({ ...r, meta: metaMap.get(r.id), screenshots: shotsMap.get(r.id) || [] }));
    },
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['gsh-posts', id, filteredFriendIds],
    enabled: !!id && filteredFriendIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('forum_posts')
        .select('id,user_id,title,content,created_at,likes_count,is_spoiler,spoiler_achievement_name,profile:user_id(display_name,avatar_url)')
        .eq('product_id', id).in('user_id', filteredFriendIds)
        .order('created_at', { ascending: false }).limit(50);
      return (data as any[]) || [];
    },
  });

  const { data: clips = [] } = useQuery({
    queryKey: ['gsh-clips', id, filteredFriendIds],
    enabled: !!id && filteredFriendIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('game_clips')
        .select('id,user_id,title,thumbnail_url,video_url,created_at,is_spoiler,spoiler_achievement_name,profile:user_id(display_name)')
        .eq('product_id', id).in('user_id', filteredFriendIds)
        .order('created_at', { ascending: false }).limit(24);
      return (data as any[]) || [];
    },
  });

  const friendsAndSelf = useMemo(
    () => (user ? [user.id, ...filteredFriendIds] : filteredFriendIds),
    [user, filteredFriendIds]
  );
  
  const { data: reviewsCompletasNew = [] } = useQuery<ReviewCompletaData[]>({
    queryKey: ['gsh-reviews-completas', id, friendsAndSelf],
    enabled: !!id && friendsAndSelf.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('reviews_completas' as any)
        .select('*, profile:user_id(display_name,avatar_url)')
        .eq('product_id', id!).in('user_id', friendsAndSelf)
        .order('created_at', { ascending: false });
      return ((data as any[]) || []) as ReviewCompletaData[];
    },
  });
  
  const myReviewCompleta = useMemo(
    () => reviewsCompletasNew.find(r => r.user_id === user?.id),
    [reviewsCompletasNew, user?.id]
  );

  // GAP-504: Calcular novidades (últimas 24h)
  useEffect(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const counts: Record<Tab, number> = {
      biblioteca: library.filter((l: any) => new Date(l.status_updated_at) > yesterday).length,
      reviews: reviews.filter((r: any) => new Date(r.created_at) > yesterday).length,
      reviewsCompletas: reviewsCompletasNew.filter((r: any) => new Date(r.created_at) > yesterday).length,
      screenshots: 0, // Será calculado abaixo
      discussoes: posts.filter((p: any) => new Date(p.created_at) > yesterday).length,
      historico: 0,
    };
    
    // Calcular screenshots novas
    let screenshotCount = 0;
    reviews.forEach((r: any) => {
      r.screenshots?.forEach((s: any) => {
        if (new Date(s.created_at) > yesterday) screenshotCount++;
      });
    });
    counts.screenshots = screenshotCount;
    
    setNewActivityCounts(counts);
  }, [library, reviews, reviewsCompletasNew, posts]);

  const visibleScreenshots = useMemo(() => {
    const all: any[] = [];
    reviews.forEach((r: any) => r.screenshots?.forEach((s: any) => all.push({ ...s, review: r })));
    return all.filter(s => {
      if (s.visibility !== 'private') return true;
      const owner = s.owner_id || s.review?.user_id;
      return owner === user?.id;
    });
  }, [reviews, user?.id]);

  const reviewsCompletas = useMemo(
    () => reviews.filter((r: any) => r.meta && (r.meta.hours_played || r.meta.platform || r.meta.mood)),
    [reviews]
  );
  const reviewsSimples = useMemo(
    () => reviews.filter((r: any) => !r.meta || (!r.meta.hours_played && !r.meta.platform && !r.meta.mood)),
    [reviews]
  );

  const sortItems = <T extends { created_at: string; likes_count?: number; user_id?: string }>(arr: T[]): T[] => {
    const copy = [...arr];
    if (sort === 'recent') copy.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sort === 'liked') copy.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    if (sort === 'trending') {
      copy.sort((a, b) => {
        const score = (x: any) => (x.likes_count || 0) * 2 + (Date.now() - +new Date(x.created_at) < 7 * 86400000 ? 5 : 0);
        return score(b) - score(a);
      });
    }
    if (sort === 'close') copy.sort((a, b) =>
      (closeFriendIds.includes(b.user_id || '') ? 1 : 0) - (closeFriendIds.includes(a.user_id || '') ? 1 : 0)
    );
    return copy;
  };

  const historico = useMemo(() => {
    const events: any[] = [];
    library.forEach((l: any) => events.push({ kind: 'library', date: l.status_updated_at, data: l }));
    reviews.forEach((r: any) => events.push({ kind: 'review', date: r.created_at, data: r }));
    posts.forEach((p: any) => events.push({ kind: 'post', date: p.created_at, data: p }));
    clips.forEach((c: any) => events.push({ kind: 'clip', date: c.created_at, data: c }));
    return events.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [library, reviews, posts, clips]);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!game) return <div className="container mx-auto px-4 py-16 text-center"><p className="text-muted-foreground">Jogo não encontrado.</p></div>;

  const openLightbox = (items: LightboxItem[], index: number) => setLightbox({ items, index });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to={`/jogo/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar ao jogo
      </Link>

      {/* Cinematic header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent z-10" />
        {game.image && <img src={game.image} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="" loading="lazy" />}
        <div className="relative z-20 p-8">
          <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Hub Social Privado · Apenas amigos
          </p>
          <h1 className="text-3xl font-bold text-foreground">{game.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">O que seu círculo está fazendo neste jogo</p>
          <div className="flex gap-4 mt-4 text-xs text-foreground flex-wrap">
            <span><Users className="inline h-3 w-3 mr-1" />{filteredFriendIds.length} amigos</span>
            <span><Library className="inline h-3 w-3 mr-1" />{library.length} têm</span>
            <span><Star className="inline h-3 w-3 mr-1" />{reviews.length} reviews</span>
            <span><ImageIcon className="inline h-3 w-3 mr-1" />{visibleScreenshots.length} screenshots</span>
            <span><MessageSquare className="inline h-3 w-3 mr-1" />{posts.length} discussões</span>
          </div>
        </div>
      </motion.div>

      {loadingFriends ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando círculo">
          <div className="h-10 w-full rounded-lg bg-muted/40 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        </div>
      ) : !hasFriends ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">Seu círculo está vazio</p>
            <p className="text-sm text-muted-foreground mt-1">Siga amigos (e seja seguido de volta) para ver atividade aqui.</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center pt-1">
            <Link to="/social" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90">
              Encontrar amigos
            </Link>
            <Link to={`/jogo/${id}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border hover:bg-muted/40">
              Ver página do jogo
            </Link>
            <Link to="/oportunidades" className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border hover:bg-muted/40">
              Explorar oportunidades
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs com GAP-504: Badge de novidades */}
          <div className="flex flex-wrap gap-1 border-b border-border mb-4 overflow-x-auto">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              const hasNew = newActivityCounts[t.id] > 0;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap relative ${
                    active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}>
                  <Icon className="h-3.5 w-3.5" /> {t.label}
                  {hasNew && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* GAP-507: Filtro "Close Friends" */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button
              onClick={() => setCloseFriendsOnly(!closeFriendsOnly)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                closeFriendsOnly 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3 w-3" />
              {closeFriendsOnly ? 'Close Friends' : 'Todos os amigos'}
            </button>

            {/* Filtros de ordenação */}
            <div className="flex items-center gap-1 ml-auto">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {([
                { k: 'recent', label: 'Recentes', icon: Sparkles },
                { k: 'liked', label: 'Mais curtidos', icon: Heart },
                { k: 'trending', label: 'Tendência', icon: TrendingUp },
                { k: 'close', label: 'Próximos', icon: Users },
              ] as { k: SortKey; label: string; icon: any }[]).map(o => {
                const Icon = o.icon;
                const active = sort === o.k;
                return (
                  <button key={o.k} onClick={() => setSort(o.k)}
                    className={`px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 border transition-colors ${
                      active ? 'border-primary bg-primary/10 text-primary glow-primary' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}>
                    <Icon className="h-3 w-3" />{o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          {tab === 'biblioteca' && (
            <section className="bg-card border border-border rounded-xl p-5">
              {library.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <Library className="h-7 w-7 mx-auto text-muted-foreground" />
                  <p className="text-sm text-foreground font-medium">Nenhum amigo tem este jogo ainda.</p>
                  <p className="text-xs text-muted-foreground">Que tal ser a referência do círculo nele?</p>
                  <div className="flex gap-2 justify-center pt-1">
                    <Link to={`/jogo/${id}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90">
                      Adicionar à biblioteca
                    </Link>
                    <Link to={`/jogo/${id}#bundles`} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border hover:bg-muted/40">
                      Ver ofertas
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sortItems(library as any).map((l: any) => {
                    const status = STATUS_LABEL[l.status] || { label: l.status, color: 'text-muted-foreground' };
                    return (
                      <li key={l.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                        <Link to={`/perfil/${l.user_id}`} className="flex items-center gap-2 flex-1 min-w-0">
                          {l.profile?.avatar_url
                            ? <img src={l.profile.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" loading="lazy" />
                            : <div className="w-9 h-9 rounded-full bg-primary/20" />}
                          <span className="text-sm text-foreground truncate">{l.profile?.display_name || 'Amigo'}</span>
                        </Link>
                        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {tab === 'reviews' && (
            <ReviewsList reviews={sortItems(reviewsSimples as any)} onOpenShot={openLightbox} />
          )}

          {tab === 'reviewsCompletas' && (
            <section className="space-y-4">
              {user && (
                <div className="flex justify-end">
                  <Link to={`/jogo/${id}/review-completa`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground font-semibold">
                    <Pencil className="h-3.5 w-3.5" />
                    {myReviewCompleta ? 'Editar minha Review Completa' : 'Escrever Review Completa'}
                  </Link>
                </div>
              )}
              {reviewsCompletasNew.length === 0 ? (
                <EstadoVazio icone={BookOpen} titulo="Nenhuma Review Completa ainda" descricao="Seja o primeiro a escrever uma para este jogo." />
              ) : (
                sortItems(reviewsCompletasNew as any).map((r: any) => (
                  <ReviewCompletaCard key={r.id} review={r} />
                ))
              )}
            </section>
          )}

          {tab === 'screenshots' && (
            <section>
              {visibleScreenshots.length === 0 ? (
                <EstadoVazio icone={ImageIcon} titulo="Sem screenshots ainda" descricao="Quando amigos publicarem, elas aparecem aqui." />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {visibleScreenshots.map((s, i) => (
                    <button key={s.id} onClick={() => openLightbox(
                      visibleScreenshots.map(x => ({
                        url: x.image_url,
                        author: x.review?.profile?.display_name,
                        caption: x.review?.comment?.slice(0, 80),
                      })), i)}
                      className="aspect-video bg-muted rounded-lg overflow-hidden group relative">
                      <img src={s.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" loading="lazy" />
                      {s.visibility === 'private' && (
                        <span className="absolute top-1 right-1 text-[9px] bg-destructive/80 text-destructive-foreground px-1.5 py-0.5 rounded">Privado</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {clips.length > 0 && (
                <>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mt-6 mb-2">
                    <Film className="h-4 w-4 text-accent" /> Clipes
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {clips.map((c: any) => (
                      <SpoilerGuard
                        key={c.id}
                        isSpoiler={!!c.is_spoiler}
                        achievementName={c.spoiler_achievement_name}
                        productId={id}
                      >
                        <a href={c.video_url} target="_blank" rel="noreferrer"
                          className="block bg-card border border-border rounded-lg overflow-hidden">
                          <div className="aspect-video bg-muted">
                            {c.thumbnail_url && <img src={c.thumbnail_url} className="w-full h-full object-cover" alt="" loading="lazy" />}
                          </div>
                          <p className="text-[10px] text-foreground p-2 line-clamp-1">{c.profile?.display_name} {c.title && `· ${c.title}`}</p>
                        </a>
                      </SpoilerGuard>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {tab === 'discussoes' && (
            <section className="space-y-2">
              {posts.length === 0 ? (
                <EstadoVazio icone={MessageSquare} titulo="Sem discussões ainda" descricao="Inicie uma conversa sobre este jogo." />
              ) : (
                sortItems(posts as any).map((p: any) => (
                  <PostCard key={p.id} post={p} productId={id} />
                ))
              )}
            </section>
          )}

          {tab === 'historico' && (
            <section className="space-y-2">
              {historico.length === 0 ? (
                <EstadoVazio icone={History} titulo="Sem histórico ainda" descricao="A atividade do seu círculo aparecerá aqui." />
              ) : historico.map((e, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-3 flex items-start gap-3">
                  <span className="mt-0.5 text-primary">
                    {e.kind === 'library' && <Library className="h-4 w-4" />}
                    {e.kind === 'review' && <Star className="h-4 w-4" />}
                    {e.kind === 'post' && <MessageSquare className="h-4 w-4" />}
                    {e.kind === 'clip' && <Film className="h-4 w-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">
                      <Link to={`/perfil/${e.data.user_id}`} className="font-semibold hover:text-primary">
                        {e.data.profile?.display_name || 'Amigo'}
                      </Link>{' '}
                      {e.kind === 'library' && <>marcou como <span className="text-primary">{STATUS_LABEL[e.data.status]?.label || e.data.status}</span></>}
                      {e.kind === 'review' && <>publicou um review <HalfStarDisplay rating={Number(e.data.rating)} size={10} className="inline-flex ml-1" /></>}
                      {e.kind === 'post' && <>iniciou uma discussão{e.data.title ? `: ${e.data.title}` : ''}</>}
                      {e.kind === 'clip' && <>compartilhou um clipe{e.data.title ? `: ${e.data.title}` : ''}</>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(e.date)}</p>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {lightbox && <MediaLightbox items={lightbox.items} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// GAP-506: Componente PostCard com reações
function PostCard({ post, productId }: { post: any; productId?: string }) {
  const { reactions, userReaction, react, isReacting } = useReactions(post.id);

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Link to={`/perfil/${post.user_id}`} className="text-xs font-semibold text-foreground hover:text-primary">
          {post.profile?.display_name}
        </Link>
        <span className="text-[10px] text-muted-foreground">{formatDate(post.created_at)}</span>
        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
          <Heart className="h-3 w-3" /> {post.likes_count || 0}
        </span>
      </div>
      <SpoilerGuard
        isSpoiler={!!post.is_spoiler}
        achievementName={post.spoiler_achievement_name}
        productId={productId}
      >
        {post.title && <p className="text-sm font-semibold text-foreground">{post.title}</p>}
        <p className="text-xs text-muted-foreground line-clamp-3">{post.content}</p>
      </SpoilerGuard>
      
      {/* GAP-506: Reações */}
      <div className="mt-2 flex items-center gap-2">
        <ReactionSelector
          postId={post.id}
          reactions={reactions}
          userReaction={userReaction}
          onReact={react}
          isReacting={isReacting}
        />
      </div>
    </div>
  );
}

function ReviewsList({ reviews, onOpenShot, full }: {
  reviews: any[]; full?: boolean;
  onOpenShot: (items: LightboxItem[], i: number) => void;
}) {
  if (reviews.length === 0) {
    return <EstadoVazio icone={Star} titulo={full ? 'Sem reviews completas ainda' : 'Sem reviews ainda'} descricao="Quando amigos avaliarem este jogo, aparece aqui." />;
  }
  return (
    <div className="space-y-3">
      {reviews.map((r: any) => (
        <article key={r.id} className="bg-card border border-border rounded-xl p-4">
          <header className="flex items-center gap-3 mb-2">
            <Link to={`/perfil/${r.user_id}`} className="flex items-center gap-2 hover:opacity-80">
              {r.profile?.avatar_url
                ? <img src={r.profile.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" loading="lazy" />
                : <div className="w-9 h-9 rounded-full bg-primary/20" />}
              <span className="text-sm font-semibold text-foreground">{r.profile?.display_name || 'Amigo'}</span>
            </Link>
            <HalfStarDisplay rating={Number(r.rating)} size={14} />
            <span className="ml-auto text-[10px] text-muted-foreground">{formatDate(r.created_at)}</span>
          </header>
          {full && r.meta && (
            <div className="flex flex-wrap gap-1.5 mb-2 text-[10px]">
              {r.meta.hours_played != null && <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"><Clock className="inline h-3 w-3 mr-1" />{r.meta.hours_played}h</span>}
              {r.meta.platform && <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{r.meta.platform}</span>}
              {r.meta.mood && <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent">{r.meta.mood}</span>}
              {r.meta.difficulty && <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning">{r.meta.difficulty}</span>}
              {r.meta.completion && <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary">{r.meta.completion}</span>}
              {r.meta.has_spoiler && <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">spoilers</span>}
            </div>
          )}
          {r.comment && <p className="text-sm text-foreground whitespace-pre-wrap">{r.comment}</p>}
          {r.screenshots?.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {r.screenshots.slice(0, 6).map((s: any, i: number) => (
                <button key={s.id} onClick={() => onOpenShot(
                  r.screenshots.map((x: any) => ({ url: x.image_url, author: r.profile?.display_name, caption: r.comment?.slice(0, 80) })), i)}
                  className="aspect-video bg-muted rounded overflow-hidden group">
                  <img src={s.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}