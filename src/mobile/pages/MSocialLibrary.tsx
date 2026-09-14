import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMutualFriends, useFriendActivityStates, useSetActivityState, useRealtimeActivityStates,
  type ActivityState, type ActivityType, type FriendActivityItem,
} from '@/hooks/useFriendActivity';
import { ArrowLeft, Users, Heart, Bookmark, EyeOff, Sparkles, Star, Library, MessageSquare, ChevronRight, Search, X, CheckCheck, Loader2 } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { FeedItemSkeleton } from '@/components/skeletons';
import { formatDateShort } from '@/lib/format';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';

type Tab = 'new' | 'liked' | 'saved' | 'hidden';

// GAP-1112: Marcar todos como vistos
async function markAllAsSeen(userId: string, items: FriendActivityItem[]) {
  const newItems = items.filter(i => i.state === 'new');
  if (newItems.length === 0) return;
  
  const inserts = newItems.map(item => ({
    user_id: userId,
    activity_id: item.id,
    state: 'seen',
    updated_at: new Date().toISOString(),
  }));
  
  const { error } = await supabase
    .from('friend_activity_states')
    .upsert(inserts, { onConflict: 'user_id, activity_id' });
  
  if (error) throw error;
}

export default function MSocialLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useDocumentMeta({
    title: 'Biblioteca social — MIDIAS',
    description: 'Veja o que seus amigos estão jogando, avaliando e comentando.',
  });
  const { data: friendIds = [], isLoading: loadingFriends } = useMutualFriends();
  const { data: stateMap = {} } = useFriendActivityStates();
  const setState = useSetActivityState();
  useRealtimeActivityStates();

  const [tab, setTab] = useState<Tab>('new');
  const [items, setItems] = useState<FriendActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  
  // GAP-1112: Estado para marcar todos como vistos
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    if (friendIds.length === 0) { setItems([]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const [libRes, revRes, postRes] = await Promise.all([
        supabase.from('biblioteca_usuario')
          .select('id, user_id, product_id, status, acquired_at, profiles!inner(display_name, avatar_url, is_private), produtos!inner(title, image_url)')
          .in('user_id', friendIds).order('acquired_at', { ascending: false }).limit(60),
        supabase.from('avaliacoes')
          .select('id, user_id, product_id, rating, comment, created_at, profiles!inner(display_name, avatar_url, is_private), produtos!inner(title, image_url)')
          .in('user_id', friendIds).eq('is_approved', true).order('created_at', { ascending: false }).limit(60),
        supabase.from('forum_posts')
          .select('id, user_id, content, title, product_id, created_at, profiles!inner(display_name, avatar_url, is_private)')
          .in('user_id', friendIds).order('created_at', { ascending: false }).limit(60),
      ]);

      const lib: FriendActivityItem[] = (((libRes.data as any[]) || []).filter(r => !r.profiles?.is_private)).map(r => ({
        id: r.id, type: 'library' as ActivityType, friend_id: r.user_id,
        friend_name: r.profiles?.display_name, friend_avatar: r.profiles?.avatar_url,
        product_id: r.product_id, product_title: r.produtos?.title, product_image: r.produtos?.image_url,
        status: r.status, created_at: r.acquired_at, state: 'new' as ActivityState,
      }));
      const rev: FriendActivityItem[] = (((revRes.data as any[]) || []).filter(r => !r.profiles?.is_private)).map(r => ({
        id: r.id, type: 'review' as ActivityType, friend_id: r.user_id,
        friend_name: r.profiles?.display_name, friend_avatar: r.profiles?.avatar_url,
        product_id: r.product_id, product_title: r.produtos?.title, product_image: r.produtos?.image_url,
        rating: Number(r.rating), comment: r.comment, created_at: r.created_at, state: 'new' as ActivityState,
      }));
      const posts: FriendActivityItem[] = (((postRes.data as any[]) || []).filter(r => !r.profiles?.is_private)).map(r => ({
        id: r.id, type: 'post' as ActivityType, friend_id: r.user_id,
        friend_name: r.profiles?.display_name, friend_avatar: r.profiles?.avatar_url,
        product_id: r.product_id, content: r.title ? `${r.title} — ${r.content}` : r.content,
        created_at: r.created_at, state: 'new' as ActivityState,
      }));

      const all = [...lib, ...rev, ...posts].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setItems(all);
      setLoading(false);
    })();
  }, [user, friendIds]);

  const withState = useMemo(
    () => items.map(it => ({ ...it, state: (stateMap[it.id] || 'new') as ActivityState })),
    [items, stateMap],
  );

  const filtered = useMemo(() => {
    const base = tab === 'new'
      ? withState.filter(i => i.state === 'new' || i.state === 'seen')
      : withState.filter(i => i.state === tab);
    const q = busca.trim().toLowerCase();
    if (!q) return base;
    return base.filter(i =>
      (i.friend_name || '').toLowerCase().includes(q) ||
      (i.product_title || '').toLowerCase().includes(q) ||
      (i.comment || '').toLowerCase().includes(q) ||
      (i.content || '').toLowerCase().includes(q)
    );
  }, [withState, tab, busca]);

  // marca como visto ao entrar na viewport (motor de não-repetição, igual à web)
  useEffect(() => {
    if (tab !== 'new') return;
    const obs = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        const id = el.dataset.activityId;
        const type = el.dataset.activityType as ActivityType;
        const friendId = el.dataset.friendId;
        if (id && type && friendId && (stateMap[id] || 'new') === 'new') {
          setState.mutate({ type, refId: id, friendId, state: 'seen' });
        }
      });
    }, { threshold: 0.6 });
    document.querySelectorAll<HTMLElement>('[data-activity-id]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [filtered, tab, stateMap, setState]);

  // GAP-1112: Marcar todos como vistos
  const handleMarkAllAsSeen = async () => {
    const newItems = withState.filter(i => i.state === 'new');
    if (newItems.length === 0) {
      toast.info('Nenhuma atividade nova para marcar');
      return;
    }

    setMarkingAll(true);
    try {
      await markAllAsSeen(user!.id, withState);
      queryClient.invalidateQueries({ queryKey: ['friend-activity-states'] });
      // Invalidação única em vez de N mutations
      // O hook useRealtimeActivityStates escuta mudanças e atualiza sozinho.
      toast.success(`${newItems.length} atividade(s) marcadas como vistas`);
    } catch {
      toast.error('Erro ao marcar atividades como vistas');
    } finally {
      setMarkingAll(false);
    }
  };

  const tabs: { k: Tab; label: string; icon: typeof Sparkles; count: number }[] = [
    { k: 'new', label: 'Novidades', icon: Sparkles, count: withState.filter(i => i.state === 'new').length },
    { k: 'liked', label: 'Curtidos', icon: Heart, count: withState.filter(i => i.state === 'liked').length },
    { k: 'saved', label: 'Salvos', icon: Bookmark, count: withState.filter(i => i.state === 'saved').length },
    { k: 'hidden', label: 'Ocultos', icon: EyeOff, count: withState.filter(i => i.state === 'hidden').length },
  ];

  const hasNew = withState.some(i => i.state === 'new');

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-20 glass px-3 py-2.5 flex items-center gap-2">
        <Link to="/m/amigos" aria-label="Voltar" className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full focus-ring">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-base font-display font-bold truncate">Biblioteca social</h1>
          <p className="text-[11px] text-muted-foreground">
            {friendIds.length} {friendIds.length === 1 ? 'amigo mútuo' : 'amigos mútuos'} · sem repetir
          </p>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {/* GAP-1112: Marcar todos como vistos */}
          {hasNew && tab === 'new' && (
            <button
              onClick={handleMarkAllAsSeen}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Marcar lidas
            </button>
          )}
          <Library className="h-5 w-5 text-primary" />
        </div>
      </header>

      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por amigo ou jogo"
            aria-label="Buscar na biblioteca social"
            className="w-full min-h-[44px] pl-9 pr-10 rounded-xl bg-card border border-border text-sm focus-ring"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full focus-ring"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin px-3 py-3">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`shrink-0 inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-full text-xs font-semibold transition-colors focus-ring ${
                active ? 'bg-primary text-primary-foreground glow-primary' : 'bg-card border border-border text-muted-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-primary-foreground/20' : 'bg-secondary'}`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-3">
        {loadingFriends || loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <FeedItemSkeleton key={i} />)}</div>
        ) : friendIds.length === 0 ? (
          <EstadoVazio
            icone={Users}
            titulo="Você ainda não tem amigos mútuos"
            descricao="Siga pessoas e, quando elas seguirem de volta, a atividade delas aparece aqui."
            acao={{ label: 'Descobrir pessoas', to: '/m/amigos?tab=discover' }}
          />
        ) : filtered.length === 0 ? (
          <EstadoVazio
            icone={Sparkles}
            titulo={
              tab === 'new' ? 'Tudo em dia! Nenhuma novidade dos amigos.' :
              tab === 'liked' ? 'Você ainda não curtiu nada.' :
              tab === 'saved' ? 'Nada salvo ainda.' :
              'Nenhum item oculto.'
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {filtered.map(it => {
              const destino = it.product_id ? `/m/forum/jogo/${it.product_id}` : `/m/perfil/${it.friend_id}`;
              return (
                <li
                  key={`${it.type}-${it.id}`}
                  data-activity-id={it.id}
                  data-activity-type={it.type}
                  data-friend-id={it.friend_id}
                  className={`bg-card border border-border rounded-xl overflow-hidden ${it.state === 'new' ? 'ring-1 ring-primary/30' : ''}`}
                >
                  <Link to={destino} className="flex gap-3 p-3 active:opacity-80">
                    <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden shrink-0">
                      {it.friend_avatar
                        ? <img src={it.friend_avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center text-xs font-semibold">{(it.friend_name || '?')[0]}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-semibold truncate">{it.friend_name || 'Amigo'}</span>
                        {it.state === 'new' && (
                          <span className="text-[9px] uppercase tracking-wide bg-primary/15 text-primary px-1.5 rounded shrink-0">novo</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatDateShort(it.created_at)}</span>
                      </div>
                      {it.type === 'library' && (
                        <p className="text-xs break-words">
                          <span className="text-muted-foreground">
                            {it.status === 'jogando' ? 'está jogando' : it.status === 'zerado' ? 'zerou' : it.status === 'quero_jogar' ? 'quer jogar' : 'adicionou'}
                          </span>{' '}
                          <span className="font-medium">{it.product_title}</span>
                        </p>
                      )}
                      {it.type === 'review' && (
                        <p className="text-xs break-words">
                          <span className="text-muted-foreground">avaliou</span>{' '}
                          <span className="font-medium">{it.product_title}</span>{' '}
                          <span className="inline-flex items-center gap-0.5 text-warning align-middle">
                            <Star className="h-3 w-3 fill-current" />{it.rating?.toFixed(1)}
                          </span>
                        </p>
                      )}
                      {it.type === 'post' && (
                        <p className="text-xs flex items-start gap-1">
                          <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="line-clamp-2 break-words">{it.content}</span>
                        </p>
                      )}
                    </div>
                    {it.product_image
                      ? <img src={it.product_image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground self-center shrink-0" />}
                  </Link>

                  <div className="flex items-center border-t border-border/50">
                    <button
                      onClick={() => setState.mutate({ type: it.type, refId: it.id, friendId: it.friend_id, state: it.state === 'liked' ? 'seen' : 'liked' })}
                      disabled={setState.isPending}
                      className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-semibold focus-ring ${it.state === 'liked' ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      <Heart className={`h-4 w-4 ${it.state === 'liked' ? 'fill-current' : ''}`} /> Curtir
                    </button>
                    <button
                      onClick={() => setState.mutate({ type: it.type, refId: it.id, friendId: it.friend_id, state: it.state === 'saved' ? 'seen' : 'saved' })}
                      disabled={setState.isPending}
                      className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-semibold border-l border-border/50 focus-ring ${it.state === 'saved' ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      <Bookmark className={`h-4 w-4 ${it.state === 'saved' ? 'fill-current' : ''}`} /> Salvar
                    </button>
                    <button
                      onClick={() => setState.mutate({ type: it.type, refId: it.id, friendId: it.friend_id, state: it.state === 'hidden' ? 'seen' : 'hidden' })}
                      disabled={setState.isPending}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-semibold border-l border-border/50 text-muted-foreground focus-ring"
                    >
                      <EyeOff className="h-4 w-4" /> {it.state === 'hidden' ? 'Restaurar' : 'Ocultar'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}