// Amigos favoritos — gerido APENAS pelo dono na página de Perfil Web.
// Lista amigos mútuos + permite favoritar/desfavoritar.
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Star, User, Users, Search, ArrowUpDown, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import EstadoVazio from '@/components/EstadoVazio';
import ErroCarregamento from '@/components/ErroCarregamento';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const MAX_FAVORITES = 10;

interface Friend {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_favorite: boolean;
  last_message_at: string | null;
}

type SortOption = 'name' | 'recent' | 'favorite';

export default function FriendFavoritesTab() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  // GAP-FF01: Busca
  const [search, setSearch] = useState('');
  // GAP-FF02: Ordenação
  const [sortBy, setSortBy] = useState<SortOption>('favorite');

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    setErro(false);
    
    try {
      const [{ data: rels, error: e1 }, { data: favs, error: e2 }] = await Promise.all([
        supabase.from('v_friendships').select('friend_id').eq('user_id', user.id),
        supabase.from('friend_favorites').select('friend_id').eq('user_id', user.id),
      ]);
      
      if (e1 || e2) { setErro(true); setLoading(false); return; }
      
      const friendIds = [...new Set((rels || []).map((r: any) => r.friend_id))];
      const favSet = new Set((favs || []).map((f: any) => f.friend_id));
      
      if (friendIds.length === 0) { setFriends([]); setLoading(false); return; }
      
      // GAP-FF03: Buscar última mensagem
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('conversation_id, created_at, sender_id, receiver_id')
        .or(`sender_id.in.(${friendIds.join(',')}),receiver_id.in.(${friendIds.join(',')})`)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      const lastMsgMap = new Map<string, string>();
      (lastMsg || []).forEach((msg: any) => {
        const friendId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!lastMsgMap.has(friendId) || msg.created_at > lastMsgMap.get(friendId)!) {
          lastMsgMap.set(friendId, msg.created_at);
        }
      });
      
      const { data: profs, error: e3 } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', friendIds);
        
      if (e3) { setErro(true); setLoading(false); return; }
      
      const list: Friend[] = (profs || []).map(p => ({
        id: p.id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        is_favorite: favSet.has(p.id),
        last_message_at: lastMsgMap.get(p.id) || null,
      }));
      
      setFriends(list);
      setLoading(false);
    } catch {
      setErro(true);
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [user?.id]);

  // GAP-FF01 + GAP-FF02: Filtrar e ordenar
  const filteredFriends = useMemo(() => {
    let result = [...friends];
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f => 
        (f.display_name || '').toLowerCase().includes(q)
      );
    }
    
    result.sort((a, b) => {
      if (sortBy === 'favorite') {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
      }
      if (sortBy === 'recent') {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      }
      return (a.display_name || '').localeCompare(b.display_name || '');
    });
    
    return result;
  }, [friends, search, sortBy]);

  const toggle = async (friend: Friend) => {
    if (!user || salvando) return;
    
    // GAP-FF04: Limite de favoritos
    if (!friend.is_favorite) {
      const currentFavorites = friends.filter(f => f.is_favorite).length;
      if (currentFavorites >= MAX_FAVORITES) {
        toast.error(`Limite de ${MAX_FAVORITES} favoritos atingido`);
        return;
      }
    }
    
    setSalvando(friend.id);
    
    if (friend.is_favorite) {
      const { error } = await supabase.from('friend_favorites').delete()
        .eq('user_id', user.id).eq('friend_id', friend.id);
      if (error) { setSalvando(null); toast.error('Não foi possível remover dos favoritos'); return; }
      toast.success('Removido dos favoritos');
    } else {
      const { error } = await supabase.from('friend_favorites').insert({
        user_id: user.id, friend_id: friend.id,
      });
      if (error) { setSalvando(null); toast.error('Não foi possível favoritar'); return; }
      toast.success('Marcado como favorito ⭐');
    }
    
    setFriends(prev => prev.map(f => f.id === friend.id ? { ...f, is_favorite: !f.is_favorite } : f));
    setSalvando(null);
  };

  if (loading) return (
    <div className="space-y-2">
      {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
    </div>
  );
  if (erro) return <ErroCarregamento titulo="Não foi possível carregar seus amigos" onRetry={() => carregar()} />;

  const favoritos = filteredFriends.filter(f => f.is_favorite);
  const normais = filteredFriends.filter(f => !f.is_favorite);

  const linha = (f: Friend) => (
    <li key={f.id} className="flex items-center gap-3 p-2.5 bg-secondary/40 rounded-lg transition-all hover:bg-secondary/70">
      <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden shrink-0">
        {f.avatar_url
          ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center"><User className="h-4 w-4 text-muted-foreground" /></div>}
      </div>
      <Link to={`/amigo/${f.id}`} className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block hover:text-primary">
          {f.display_name || 'Amigo'}
        </span>
        {/* GAP-FF03: Último contato */}
        {f.last_message_at && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {new Date(f.last_message_at).toLocaleDateString('pt-BR')}
          </span>
        )}
      </Link>
      <button 
        onClick={() => toggle(f)} 
        disabled={salvando === f.id || (!f.is_favorite && favoritos.length >= MAX_FAVORITES)}
        className={cn(
          "p-2 rounded-lg transition-colors disabled:opacity-50 shrink-0",
          f.is_favorite ? 'bg-warning/20 text-warning' : 'text-muted-foreground hover:text-warning',
          "relative"
        )}
        title={f.is_favorite ? 'Remover dos favoritos' : 'Favoritar'}
      >
        <Star className={cn("h-4 w-4", f.is_favorite ? 'fill-current' : '')} />
        {/* GAP-FF05: Indicador de limite */}
        {!f.is_favorite && favoritos.length >= MAX_FAVORITES && (
          <span className="absolute -top-1 -right-1 text-[8px] text-muted-foreground">🔒</span>
        )}
      </button>
    </li>
  );

  const favoriteCount = favoritos.length;

  return (
    <div>
      {/* GAP-FF01: Busca */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar amigos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>
      
      {/* GAP-FF02: Ordenação */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground">Ordenar:</span>
        <button
          onClick={() => setSortBy('favorite')}
          className={cn(
            "text-xs px-2 py-1 rounded transition",
            sortBy === 'favorite' ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-muted"
          )}
        >
          <Star className="h-3 w-3 inline mr-1" /> Favoritos
        </button>
        <button
          onClick={() => setSortBy('name')}
          className={cn(
            "text-xs px-2 py-1 rounded transition",
            sortBy === 'name' ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-muted"
          )}
        >
          <ArrowUpDown className="h-3 w-3 inline mr-1" /> Nome
        </button>
        <button
          onClick={() => setSortBy('recent')}
          className={cn(
            "text-xs px-2 py-1 rounded transition",
            sortBy === 'recent' ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-muted"
          )}
        >
          <Clock className="h-3 w-3 inline mr-1" /> Recentes
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {favoriteCount}/{MAX_FAVORITES} favoritos · {friends.length} amigos
      </p>

      {friends.length === 0 ? (
        <EstadoVazio
          icone={Users}
          titulo="Você ainda não tem amigos"
          descricao="Amizade aqui é follow mútuo. Siga pessoas no app mobile e peça para te seguirem de volta."
        />
      ) : filteredFriends.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum amigo encontrado</p>
      ) : (
        <div className="space-y-5">
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Star className="h-3 w-3 fill-current text-warning" /> Favoritos ({favoritos.length})
            </h4>
            {favoritos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum favorito ainda — toque na estrela de um amigo abaixo.</p>
            ) : (
              <ul className="space-y-2">{favoritos.map(linha)}</ul>
            )}
          </section>
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Amigos ({normais.length})
            </h4>
            {normais.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todos os seus amigos estão nos favoritos.</p>
            ) : (
              <ul className="space-y-2">{normais.map(linha)}</ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}