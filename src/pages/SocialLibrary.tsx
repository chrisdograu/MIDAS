import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  useMutualFriends, useFriendActivityStates, useSetActivityState, useRealtimeActivityStates,
  type ActivityState, type ActivityType, type FriendActivityItem,
} from '@/hooks/useFriendActivity';
import { Loader2, Users, Heart, Bookmark, EyeOff, Sparkles, Star, Library, MessageSquare, CheckCheck, Trophy } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import BuscaInput from '@/components/BuscaInput';
import ErroCarregamento from '@/components/ErroCarregamento';
import { FeedItemSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import SocialFavorites from '@/components/social/SocialFavorites';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';

type Tab = 'new' | 'liked' | 'saved' | 'favoritos' | 'hidden';

// GAP-604: Atividade de torneio (apenas oficiais)
interface TournamentActivity {
  id: string;
  user_id: string;
  tournament_id: string;
  tournament_name: string;
  is_official: boolean;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null };
}

// GAP-604: Buscar participações em torneios oficiais
async function fetchOfficialTournaments(friendIds: string[]): Promise<TournamentActivity[]> {
  if (friendIds.length === 0) return [];
  
  const { data } = await supabase
    .from('tournament_participants')
    .select('id, user_id, tournament_id, created_at, tournaments!inner(title, is_official), profiles!inner(display_name, avatar_url, is_private)')
    .in('user_id', friendIds)
    .eq('tournaments.is_official', true)
    .eq('tournaments.event_state', 'finished')
    .order('created_at', { ascending: false })
    .limit(20);
  
  return ((data || []) as any[])
    .filter((r: any) => !r.profiles?.is_private)
    .map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      tournament_id: r.tournament_id,
      tournament_name: r.tournaments?.title || 'Torneio',
      is_official: r.tournaments?.is_official || false,
      created_at: r.created_at,
      profiles: r.profiles,
    }));
}

export default function SocialLibrary() {
  const { user } = useAuth();
  const { data: friendIds = [], isLoading: loadingFriends } = useMutualFriends();
  const { data: stateMap = {} } = useFriendActivityStates();
  const setState = useSetActivityState();
  useRealtimeActivityStates();

  const [tab, setTab] = useState<Tab>('new');
  const [items, setItems] = useState<FriendActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [busca, setBusca] = useState('');
  
  // GAP-603: Estado para marcar todos como vistos
  const [markingAll, setMarkingAll] = useState(false);

  // GAP-604: Atividades de torneios oficiais
  const [tournamentActivities, setTournamentActivities] = useState<TournamentActivity[]>([]);

  // Conta favoritos reais
  useEffect(() => {
    if (!user) { setFavCount(0); return; }
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('social_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (!cancelled) setFavCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user?.id, tab]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    if (friendIds.length === 0) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        const [libRes, revRes, postRes, tournRes] = await Promise.all([
          supabase.from('biblioteca_usuario')
            .select('id, user_id, product_id, status, acquired_at, profiles!inner(display_name, avatar_url, is_private), produtos!inner(title, image_url)')
            .in('user_id', friendIds).order('acquired_at', { ascending: false }).limit(60),
          supabase.from('avaliacoes')
            .select('id, user_id, product_id, rating, comment, created_at, profiles!inner(display_name, avatar_url, is_private), produtos!inner(title, image_url)')
            .in('user_id', friendIds).eq('is_approved', true).order('created_at', { ascending: false }).limit(60),
          supabase.from('forum_posts')
            .select('id, user_id, content, title, product_id, created_at, profiles!inner(display_name, avatar_url, is_private)')
            .in('user_id', friendIds).order('created_at', { ascending: false }).limit(60),
          // GAP-604: Torneios oficiais
          supabase.from('tournament_participants')
            .select('id, user_id, tournament_id, created_at, tournaments!inner(title, is_official), profiles!inner(display_name, avatar_url, is_private)')
            .in('user_id', friendIds)
            .eq('tournaments.is_official', true)
            .eq('tournaments.event_state', 'finished')
            .order('created_at', { ascending: false }).limit(20),
        ]);

        const lib: FriendActivityItem[] = (((libRes.data as any[]) || []).filter(r => !r.profiles?.is_private)).map(r => ({
          id: `lib-${r.id}`, type: 'library' as ActivityType, friend_id: r.user_id,
          friend_name: r.profiles?.display_name, friend_avatar: r.profiles?.avatar_url,
          product_id: r.product_id, product_title: r.produtos?.title, product_image: r.produtos?.image_url,
          status: r.status, created_at: r.acquired_at, state: 'new' as ActivityState,
        }));
        const rev: FriendActivityItem[] = (((revRes.data as any[]) || []).filter(r => !r.profiles?.is_private)).map(r => ({
          id: `rev-${r.id}`, type: 'review' as ActivityType, friend_id: r.user_id,
          friend_name: r.profiles?.display_name, friend_avatar: r.profiles?.avatar_url,
          product_id: r.product_id, product_title: r.produtos?.title, product_image: r.produtos?.image_url,
          rating: Number(r.rating), comment: r.comment, created_at: r.created_at, state: 'new' as ActivityState,
        }));
        const posts: FriendActivityItem[] = (((postRes.data as any[]) || []).filter(r => !r.profiles?.is_private)).map(r => ({
          id: `post-${r.id}`, type: 'post' as ActivityType, friend_id: r.user_id,
          friend_name: r.profiles?.display_name, friend_avatar: r.profiles?.avatar_url,
          product_id: r.product_id, content: r.title ? `${r.title} — ${r.content}` : r.content,
          created_at: r.created_at, state: 'new' as ActivityState,
        }));

        // GAP-604: Converter torneios oficiais para itens de atividade
        const tournItems: FriendActivityItem[] = (((tournRes.data as any[]) || []).filter(r => !r.profiles?.is_private)).map((r: any) => ({
          id: `tourn-${r.id}`, type: 'tournament' as ActivityType, friend_id: r.user_id,
          friend_name: r.profiles?.display_name, friend_avatar: r.profiles?.avatar_url,
          product_id: null, product_title: r.tournaments?.title, product_image: null,
          content: `participou do torneio oficial ${r.tournaments?.title}`,
          created_at: r.created_at, state: 'new' as ActivityState,
          is_official: true,
        }));

        const all = [...lib, ...rev, ...posts, ...tournItems].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setItems(all);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, friendIds, reloadTick]);

  // Merge state map → effective state
  const withState = useMemo(() => items.map(it => ({ ...it, state: (stateMap[it.id] || 'new') as ActivityState })), [items, stateMap]);

  const filtered = useMemo(() => {
    const base = tab === 'new'
      ? withState.filter(i => i.state === 'new' || i.state === 'seen')
      : withState.filter(i => i.state === tab);
    const termo = busca.trim().toLowerCase();
    if (!termo) return base;
    return base.filter(i =>
      `${i.friend_name || ''} ${i.product_title || ''} ${i.comment || ''} ${i.content || ''}`
        .toLowerCase().includes(termo));
  }, [withState, tab, busca]);

  // Auto mark SEEN when item enters viewport (non-repetition engine)
  useEffect(() => {
    if (tab !== 'new') return;
    const obs = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting) {
          const id = (e.target as HTMLElement).dataset.activityId;
          const type = (e.target as HTMLElement).dataset.activityType as ActivityType;
          const friendId = (e.target as HTMLElement).dataset.friendId;
          if (id && type && friendId && (stateMap[id] || 'new') === 'new') {
            setState.mutate({ type, refId: id, friendId, state: 'seen' });
          }
        }
      });
    }, { threshold: 0.6 });
    document.querySelectorAll<HTMLElement>('[data-activity-id]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [filtered, tab, stateMap, setState]);

  // GAP-603: Marcar todos como vistos
  const handleMarkAllAsSeen = async () => {
    const newItems = withState.filter(i => i.state === 'new');
    if (newItems.length === 0) {
      toast.info('Nenhuma atividade nova para marcar');
      return;
    }
    
    setMarkingAll(true);
    try {
      // Salvar no banco (persistente)
      const inserts = newItems.map(item => ({
        user_id: user!.id,
        activity_id: item.id,
        state: 'seen',
        updated_at: new Date().toISOString(),
      }));
      
      const { error } = await supabase
        .from('friend_activity_states')
        .upsert(inserts, { onConflict: 'user_id, activity_id' });
      
      if (error) throw error;
      
      // Atualizar estado local
      newItems.forEach(item => {
        setState.mutate({ type: item.type, refId: item.id, friendId: item.friend_id, state: 'seen' });
      });
      
      toast.success(`${newItems.length} atividade(s) marcadas como vistas`);
    } catch {
      toast.error('Erro ao marcar atividades como vistas');
    } finally {
      setMarkingAll(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Users className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Biblioteca social</h1>
        <p className="text-muted-foreground mb-4">Entre para ver atividade dos seus amigos.</p>
        <Link to="/auth" className="text-primary hover:underline">Entrar</Link>
      </div>
    );
  }

  const tabs: { k: Tab; label: string; icon: any; count: number }[] = [
    { k: 'new', label: 'Novidades', icon: Sparkles, count: withState.filter(i => i.state === 'new').length },
    { k: 'liked', label: 'Curtidos', icon: Heart, count: withState.filter(i => i.state === 'liked').length },
    { k: 'saved', label: 'Salvos', icon: Bookmark, count: withState.filter(i => i.state === 'saved').length },
    { k: 'favoritos', label: 'Favoritos', icon: Star, count: favCount },
    { k: 'hidden', label: 'Ocultos', icon: EyeOff, count: withState.filter(i => i.state === 'hidden').length },
  ];

  const hasNewItems = withState.some(i => i.state === 'new');

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <Library className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">Biblioteca social</h1>
          <p className="text-muted-foreground text-sm">Atividade dos seus amigos — sem nunca repetir.</p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
        <div className="text-xs text-muted-foreground">
          {friendIds.length} {friendIds.length === 1 ? 'amigo mútuo' : 'amigos mútuos'}
        </div>
        
        {/* GAP-603: Botão "Marcar todos como vistos" */}
        {hasNewItems && tab === 'new' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsSeen}
            disabled={markingAll}
            className="text-xs"
          >
            {markingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
            )}
            Marcar todos como vistos
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-3">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              <Icon className="h-4 w-4" /> {t.label}
              {t.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-primary-foreground/20' : 'bg-background'}`}>{t.count}</span>}
            </button>
          );
        })}
      </div>

      {tab !== 'favoritos' && items.length > 0 && (
        <BuscaInput value={busca} onChange={setBusca} placeholder="Buscar por amigo, jogo ou texto..." className="mb-4" />
      )}

      {tab === 'favoritos' ? (
        <SocialFavorites />
      ) : loadError ? (
        <ErroCarregamento
          titulo="Não foi possível carregar a atividade dos amigos"
          onRetry={() => setReloadTick(t => t + 1)}
        />
      ) : loadingFriends || loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <FeedItemSkeleton key={i} />)}</div>
      ) : friendIds.length === 0 ? (
        <EstadoVazio
          icone={Users}
          titulo="Você ainda não tem amigos mútuos"
          descricao="Use o app mobile para iniciar conversas e formar conexões."
        />
      ) : filtered.length === 0 ? (
        <EstadoVazio
          icone={Sparkles}
          titulo={
            busca.trim() ? 'Nenhum item encontrado' :
            tab === 'new' ? 'Tudo em dia! Nenhuma novidade dos seus amigos.' :
            tab === 'liked' ? 'Você ainda não curtiu nada.' :
            tab === 'saved' ? 'Nada salvo ainda.' :
            'Nenhum item oculto.'
          }
        />
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map(it => {
              // GAP-604: Ícone especial para torneios
              const isTournament = it.type === 'tournament';
              
              return (
                <motion.li key={it.id}
                  data-activity-id={it.id} data-activity-type={it.type} data-friend-id={it.friend_id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                  className={`bg-card border border-border rounded-xl p-4 ${it.state === 'new' ? 'ring-1 ring-primary/30' : ''}`}>
                  <div className="flex gap-3">
                    <Link to={`/perfil/${it.friend_id}`} className="shrink-0">
                      <div className="w-11 h-11 rounded-full bg-secondary overflow-hidden">
                        {it.friend_avatar ? <img src={it.friend_avatar} alt="" className="w-full h-full object-cover" loading="lazy" /> :
                          <div className="w-full h-full flex items-center justify-center text-sm font-semibold">{(it.friend_name || '?')[0]}</div>}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Link to={`/perfil/${it.friend_id}`} className="font-semibold hover:text-primary">{it.friend_name || 'Amigo'}</Link>
                        {it.state === 'new' && <span className="text-[10px] uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded">novo</span>}
                        <span className="text-xs text-muted-foreground">{formatDate(it.created_at)}</span>
                      </div>
                      {it.type === 'library' && it.product_title && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            {it.status === 'jogando' ? 'está jogando' : it.status === 'zerado' ? 'zerou' : it.status === 'quero_jogar' ? 'quer jogar' : 'adicionou'}
                          </span>{' '}
                          <Link to={`/jogo/${it.product_id}`} className="font-medium hover:text-primary">{it.product_title}</Link>
                        </p>
                      )}
                      {it.type === 'review' && (
                        <>
                          <p className="text-sm flex items-center gap-1 flex-wrap">
                            <span className="text-muted-foreground">avaliou</span>{' '}
                            <Link to={`/jogo/${it.product_id}`} className="font-medium hover:text-primary">{it.product_title}</Link>
                            <span className="inline-flex items-center gap-0.5 text-warning"><Star className="h-3 w-3 fill-current" />{it.rating?.toFixed(1)}</span>
                          </p>
                          {it.comment && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{it.comment}</p>}
                        </>
                      )}
                      {it.type === 'post' && (
                        <p className="text-sm flex items-start gap-1">
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="line-clamp-3">{it.content}</span>
                        </p>
                      )}
                      {/* GAP-604: Torneio oficial */}
                      {isTournament && (
                        <p className="text-sm flex items-start gap-1">
                          <Trophy className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <span className="text-foreground">participou do torneio oficial <span className="font-medium">{it.product_title || 'MIDIAS'}</span></span>
                        </p>
                      )}
                    </div>
                    {it.product_image && !isTournament && (
                      <Link to={it.product_id ? `/jogo/${it.product_id}` : '#'} className="shrink-0">
                        <img src={it.product_image} alt="" className="w-16 h-16 rounded-lg object-cover" loading="lazy" />
                      </Link>
                    )}
                    {isTournament && (
                      <div className="shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Trophy className="h-8 w-8 text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button size="sm" variant={it.state === 'liked' ? 'default' : 'ghost'} disabled={setState.isPending}
                      onClick={() => setState.mutate({ type: it.type, refId: it.id, friendId: it.friend_id, state: it.state === 'liked' ? 'seen' : 'liked' })}>
                      <Heart className={`h-4 w-4 ${it.state === 'liked' ? 'fill-current' : ''}`} /> Curtir
                    </Button>
                    <Button size="sm" variant={it.state === 'saved' ? 'default' : 'ghost'} disabled={setState.isPending}
                      onClick={() => setState.mutate({ type: it.type, refId: it.id, friendId: it.friend_id, state: it.state === 'saved' ? 'seen' : 'saved' })}>
                      <Bookmark className={`h-4 w-4 ${it.state === 'saved' ? 'fill-current' : ''}`} /> Salvar
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" disabled={setState.isPending}
                      onClick={() => setState.mutate({ type: it.type, refId: it.id, friendId: it.friend_id, state: it.state === 'hidden' ? 'seen' : 'hidden' })}>
                      <EyeOff className="h-4 w-4" /> {it.state === 'hidden' ? 'Restaurar' : 'Ocultar'}
                    </Button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}