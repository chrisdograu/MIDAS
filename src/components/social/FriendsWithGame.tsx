// Item 20 da auditoria: "Amigos que têm esse jogo".
// Cruza user_follows (quem o usuário segue) com biblioteca_usuario (quem tem este product_id).
import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, Users, Loader2, Star, Filter, UserPlus, UserCheck, Clock, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FriendWithGame {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  is_favorite?: boolean;
  is_online?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  jogando: '🟢 Jogando agora',
  zerado: '✅ Zerado',
  pausado: '⏸️ Pausado',
  abandonado: '❌ Abandonou',
  ja_joguei: '📖 Já jogou',
  quero_jogar: '📝 Quer jogar',
};

const STATUS_TONE: Record<string, string> = {
  jogando: 'bg-success/15 text-success border-success/30',
  zerado: 'bg-primary/15 text-primary border-primary/30',
  pausado: 'bg-warning/15 text-warning border-warning/30',
  abandonado: 'bg-muted text-muted-foreground border-border',
  ja_joguei: 'bg-accent/15 text-accent border-accent/30',
  quero_jogar: 'bg-secondary text-secondary-foreground border-border',
};

// GAP-FG02: Filtros
const STATUS_FILTERS = ['all', ...Object.keys(STATUS_LABEL)] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'Todos',
  jogando: 'Jogando',
  zerado: 'Zerados',
  pausado: 'Pausados',
  abandonado: 'Abandonaram',
  ja_joguei: 'Já jogaram',
  quero_jogar: 'Querem jogar',
};

interface Props {
  productId: string;
  onInvite?: (userIds: string[]) => void;
}

export default function FriendsWithGame({ productId, onInvite }: Props) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());

  // GAP-FG03: Contagem
  const activeCount = useMemo(() => friends.filter(f => f.status === 'jogando').length, [friends]);

  useEffect(() => {
    if (!user || !productId) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      // 1) Quem eu sigo
      const { data: follows } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const followingIds = (follows || []).map((f: any) => f.following_id);
      if (followingIds.length === 0) {
        if (!cancel) { setFriends([]); setLoading(false); }
        return;
      }
      // 2) Entre eles, quem tem este jogo
      const { data: lib } = await supabase
        .from('biblioteca_usuario')
        .select('user_id, status')
        .eq('product_id', productId)
        .in('user_id', followingIds);
      const rows = (lib || []) as { user_id: string; status: string }[];
      if (rows.length === 0) {
        if (!cancel) { setFriends([]); setLoading(false); }
        return;
      }
      // 3) Perfis públicos
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', rows.map(r => r.user_id));
      const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
      
      // 4) Amigos favoritos
      const { data: favs } = await supabase
        .from('friend_favorites')
        .select('friend_id')
        .eq('user_id', user.id);
      const favSet = new Set((favs || []).map((f: any) => f.friend_id));
      
      const merged: FriendWithGame[] = rows.map(r => ({
        user_id: r.user_id,
        status: r.status,
        display_name: pmap.get(r.user_id)?.display_name ?? null,
        avatar_url: pmap.get(r.user_id)?.avatar_url ?? null,
        is_favorite: favSet.has(r.user_id),
        is_online: false, // TODO: integração com presença real
      })).sort((a, b) => {
        const order = ['jogando','zerado','pausado','ja_joguei','abandonado','quero_jogar'];
        return order.indexOf(a.status) - order.indexOf(b.status);
      });
      if (!cancel) { setFriends(merged); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [user?.id, productId]);

  // GAP-FG02: Filtrar por status
  const filteredFriends = useMemo(() => {
    if (filter === 'all') return friends;
    return friends.filter(f => f.status === filter);
  }, [friends, filter]);

  // GAP-FG04: Selecionar para convite em grupo
  const toggleSelect = (userId: string) => {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const inviteSelected = () => {
    if (selectedFriends.size === 0) return;
    const ids = [...selectedFriends];
    if (onInvite) {
      onInvite(ids);
    } else {
      // Fallback: abrir chat com todos
      const chatUrl = `/chat/group?users=${ids.join(',')}`;
      window.location.href = chatUrl;
    }
    toast.success(`Convidando ${ids.length} amigo(s)`);
  };

  if (!user) return null;
  if (loading) {
    return (
      <div className="mt-12">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Amigos que têm esse jogo
        </h2>
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }
  if (friends.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Amigos que têm esse jogo
          <span className="text-xs font-normal text-muted-foreground">({friends.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          {/* GAP-FG03: Contagem de ativos */}
          {activeCount > 0 && (
            <span className="text-xs text-success flex items-center gap-1">
              <Clock className="h-3 w-3" /> {activeCount} jogando agora
            </span>
          )}
          {/* GAP-FG02: Filtro */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as StatusFilter)}
            className="text-xs bg-secondary border border-border rounded px-2 py-1"
          >
            {STATUS_FILTERS.map(f => (
              <option key={f} value={f}>{STATUS_FILTER_LABEL[f]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* GAP-FG04: Botão de convite em grupo */}
      {selectedFriends.size > 0 && (
        <div className="mb-3 flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-xs text-foreground">{selectedFriends.size} selecionado(s)</span>
          <button
            onClick={inviteSelected}
            className="ml-auto text-xs font-semibold bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:opacity-90"
          >
            <UserPlus className="h-3 w-3 inline mr-1" /> Convidar grupo
          </button>
          <button
            onClick={() => setSelectedFriends(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredFriends.map(f => (
          <div
            key={f.user_id}
            className={cn(
              "flex items-center gap-3 p-3 bg-card border rounded-xl transition hover:border-primary/40",
              selectedFriends.has(f.user_id) ? "border-primary bg-primary/5" : "border-border"
            )}
          >
            <Link to={`/perfil/${f.user_id}`} className="shrink-0 relative">
              {f.avatar_url ? (
                <img src={f.avatar_url} alt={f.display_name || ''} className="w-12 h-12 rounded-full object-cover" loading="lazy" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                  {(f.display_name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              {/* GAP-FG01: Amigo favorito */}
              {f.is_favorite && (
                <Star className="absolute -top-0.5 -right-0.5 h-4 w-4 fill-warning text-warning" />
              )}
              {f.is_online && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/perfil/${f.user_id}`} className="text-sm font-semibold text-foreground hover:text-primary truncate block">
                {f.display_name || 'Usuário'}
              </Link>
              <span className={cn("inline-block mt-1 px-2 py-0.5 text-[10px] rounded-full border", STATUS_TONE[f.status] || STATUS_TONE.ja_joguei)}>
                {STATUS_LABEL[f.status] || f.status}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* GAP-FG04: Selecionar para convite */}
              <button
                onClick={() => toggleSelect(f.user_id)}
                className={cn(
                  "p-1.5 rounded-lg transition",
                  selectedFriends.has(f.user_id)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                title="Selecionar para convite"
              >
                <UserCheck className="h-4 w-4" />
              </button>
              <Link
                to={`/chat/${f.user_id}`}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                title="Chamar pra jogar"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Chamar
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}