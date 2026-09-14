import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, UserPlus, UserCheck, Users, Search, Check, X, Clock, Library, ChevronRight, Users2 } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { escapeIlikeTerm } from '@/lib/escapeIlike';

interface Person { id: string; display_name: string | null; avatar_url: string | null; username: string | null }
interface Request { id: string; requester_id: string; created_at: string; profile: Person | null }

type Tab = 'followers' | 'following' | 'discover' | 'requests';

// GAP-1056: Buscar amigos em comum
async function getMutualFriendsCount(userId: string, targetId: string): Promise<number> {
  // Buscar amigos do usuário atual
  const { data: myFriends } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('status', 'accepted');
  const myFriendIds = new Set((myFriends || []).map(f => f.following_id));
  
  // Buscar amigos do alvo
  const { data: targetFriends } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', targetId)
    .eq('status', 'accepted');
  const targetFriendIds = new Set((targetFriends || []).map(f => f.following_id));
  
  // Interseção
  let count = 0;
  for (const id of targetFriendIds) {
    if (myFriendIds.has(id)) count++;
  }
  return count;
}

function FollowBtn({ targetId, initiallyFollowing, onChange }: { targetId: string; initiallyFollowing: boolean; onChange?: (v: boolean) => void }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setFollowing(initiallyFollowing); }, [initiallyFollowing]);
  useEffect(() => {
    if (!user || following) { setPending(false); return; }
    supabase.from('follow_requests').select('id').eq('requester_id', user.id).eq('target_id', targetId).maybeSingle()
      .then(({ data }) => setPending(!!data));
  }, [user?.id, targetId, following]);
  if (!user || user.id === targetId) return null;
  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (loading) return;
    setLoading(true);
    if (following) {
      // Optimistic
      setFollowing(false);
      onChange?.(false);
      const { error } = await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
      if (error) {
        // Rollback
        setFollowing(true);
        onChange?.(true);
        toast.error(`Não foi possível deixar de seguir: ${error.message}`);
        setLoading(false);
        return;
      }
    } else if (pending) {
      const { error } = await supabase.from('follow_requests').delete().eq('requester_id', user.id).eq('target_id', targetId);
      if (error) { toast.error(`Não foi possível cancelar o pedido: ${error.message}`); setLoading(false); return; }
      setPending(false);
      toast('Pedido cancelado');
    } else {
      const { error } = await supabase.from('follow_requests').insert({ requester_id: user.id, target_id: targetId });
      if (error && !/duplicate|unique/i.test(error.message)) { toast.error('Não foi possível seguir'); setLoading(false); return; }
      const { data: f } = await supabase.from('user_follows').select('id').eq('follower_id', user.id).eq('following_id', targetId).maybeSingle();
      if (f) { setFollowing(true); onChange?.(true); }
      else { setPending(true); toast.success('Pedido enviado'); }
    }
    setLoading(false);
  };
  const label = following
    ? <span className="inline-flex items-center gap-1"><UserCheck className="h-3 w-3" />Seguindo</span>
    : pending
      ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />Solicitado</span>
      : <span className="inline-flex items-center gap-1"><UserPlus className="h-3 w-3" />Seguir</span>;
  return (
    <button onClick={toggle} disabled={loading}
      className={`shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all ${following || pending ? 'bg-card border border-border text-foreground' : 'bg-gradient-to-r from-primary to-accent text-primary-foreground'}`}>
      {label}
    </button>
  );
}

export default function MFriends() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('tab') as Tab) || 'following';
  const [tab, setTab] = useState<Tab>(initial);
  const [followers, setFollowers] = useState<Person[]>([]);
  const [following, setFollowing] = useState<Person[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [requests, setRequests] = useState<Request[]>([]);
  const handleFollowChange = (id: string, isF: boolean) => {
    setFollowingSet(prev => {
      const next = new Set(prev);
      if (isF) next.add(id); else next.delete(id);
      return next;
    });
  };
  const [query, setQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [discover, setDiscover] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  
  // GAP-1056: Amigos em comum (cache)
  const [mutualCounts, setMutualCounts] = useState<Record<string, number>>({});

  useEffect(() => { setParams({ tab }, { replace: true }); }, [tab, setParams]);

  const loadAll = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const [{ data: fol }, { data: fing }, { data: reqs }] = await Promise.all([
      supabase.from('user_follows').select('follower_id').eq('following_id', user.id),
      supabase.from('user_follows').select('following_id').eq('follower_id', user.id),
      supabase.from('follow_requests').select('id, requester_id, created_at').eq('target_id', user.id).order('created_at', { ascending: false }),
    ]);
    const fIds = (fol || []).map((d: any) => d.follower_id);
    const gIds = (fing || []).map((d: any) => d.following_id);
    const rIds = (reqs || []).map((r: any) => r.requester_id);
    const all = [...new Set([...fIds, ...gIds, ...rIds])];
    const { data: profs } = all.length
      ? await supabase.from('profiles').select('id, display_name, avatar_url, username').in('id', all)
      : { data: [] as any[] };
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setFollowers(fIds.map(id => map.get(id)).filter(Boolean) as Person[]);
    setFollowing(gIds.map(id => map.get(id)).filter(Boolean) as Person[]);
    setFollowingSet(new Set(gIds));
    setRequests((reqs || []).map((r: any) => ({ id: r.id, requester_id: r.requester_id, created_at: r.created_at, profile: map.get(r.requester_id) as Person || null })));
    
    // GAP-1056: Amigos em comum — via RPC única (evita N+1)
    try {
      const { data: counts } = await supabase.rpc('get_mutual_friends_counts' as any, { _user_ids: all });
      const map: Record<string, number> = {};
      ((counts as any[]) || []).forEach((r: any) => { if (r.count > 0) map[r.user_id] = r.count; });
      setMutualCounts(map);
    } catch {
      // RPC pode não existir ainda — falha silenciosa
      setMutualCounts({});
    }
    
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [user?.id]);

  useEffect(() => {
    if (tab !== 'discover') return;
    const q = query.trim();
    if (q.length < 2) { setDiscover([]); return; }
    const t = setTimeout(async () => {
      const term = escapeIlikeTerm(q);
      const { data } = await supabase
        .from('profiles').select('id, display_name, avatar_url, username')
        .or(`display_name.ilike.%${term}%,username.ilike.%${term}%`)
        .not('is_paused', 'is', true)
        .limit(30);
      const results = (data as Person[]) || [];
      setDiscover(results);
      // GAP-1056: Calcular amigos em comum para resultados da busca
      // GAP-1056: Usa RPC única para contagem
      try {
        const ids = results.map(p => p.id).filter(id => id !== user.id);
        if (ids.length > 0) {
          const { data: counts } = await supabase.rpc('get_mutual_friends_counts' as any, { _user_ids: ids });
          const map: Record<string, number> = {};
          ((counts as any[]) || []).forEach((r: any) => { if (r.count > 0) map[r.user_id] = r.count; });
          setMutualCounts(prev => ({ ...prev, ...map }));
        }
      } catch {
        // RPC ausente — skip silencioso
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, tab]);

  const acceptRequest = async (reqId: string) => {
    if (processingId) return;
    setProcessingId(reqId);
    const { error } = await supabase.rpc('accept_follow_request', { _request_id: reqId } as any);
    if (error) { setProcessingId(null); toast.error(error.message || 'Erro ao aceitar'); return; }
    toast.success('Pedido aceito ✨');
    await loadAll();
    setProcessingId(null);
  };
  const rejectRequest = async (reqId: string) => {
    if (processingId) return;
    setProcessingId(reqId);
    const { error } = await supabase.from('follow_requests').delete().eq('id', reqId);
    if (error) { setProcessingId(null); toast.error(error.message || 'Erro ao recusar'); return; }
    toast('Pedido recusado');
    await loadAll();
    setProcessingId(null);
  };

  if (!user) return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground mb-4">Entre para ver seus amigos.</p>
      <Link to="/m/auth" className="inline-block px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Entrar</Link>
    </div>
  );

  const list = tab === 'followers' ? followers : tab === 'following' ? following : tab === 'discover' ? discover : [];

  return (
    <div className="px-4 py-5 space-y-4">
      <Link to="/m/perfil" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</Link>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold gradient-text flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Amigos
        </h1>
      </div>

      <Link
        to="/m/biblioteca-social"
        className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border active:opacity-80 focus-ring"
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
          <Library className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">Biblioteca social</p>
          <p className="text-[11px] text-muted-foreground truncate">O que seus amigos jogaram, avaliaram e comentaram</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>

      <div className="grid grid-cols-4 gap-1 p-1 bg-secondary/40 rounded-lg">
        {([
          { id: 'following', label: `Seguindo (${following.length})` },
          { id: 'followers', label: `Seguidores (${followers.length})` },
          { id: 'requests', label: `Pedidos${requests.length ? ` (${requests.length})` : ''}` },
          { id: 'discover', label: 'Descobrir' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} type="button"
            className={`relative py-2 px-1 rounded-md text-[10px] font-semibold ${tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            {t.label}
            {t.id === 'requests' && requests.length > 0 && tab !== 'requests' && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">{requests.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'discover' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome ou @username..."
            className="w-full pl-10 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : tab === 'requests' ? (
        requests.length === 0 ? (
          <EstadoVazio
            icone={Clock}
            titulo="Nenhuma solicitação pendente"
            descricao="Ative a aprovação manual em Configurações → Privacidade."
          />
        ) : (
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="flex items-center gap-3 glass rounded-xl p-3">
                <Link to={`/m/perfil/${r.requester_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground font-bold shrink-0">
                    {r.profile?.avatar_url ? <img src={r.profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : (r.profile?.display_name?.[0]?.toUpperCase() || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.profile?.display_name || 'Usuário'}</p>
                    {r.profile?.username && <p className="text-xs text-muted-foreground truncate">@{r.profile.username}</p>}
                    <p className="text-[10px] text-muted-foreground">quer te seguir</p>
                  </div>
                </Link>
                <button onClick={() => acceptRequest(r.id)} disabled={processingId === r.id} aria-label="Aceitar pedido de amizade" className="w-11 h-11 focus-ring rounded-full bg-success/20 text-success flex items-center justify-center disabled:opacity-50"><Check className="h-4 w-4" /></button>
                <button onClick={() => rejectRequest(r.id)} disabled={processingId === r.id} aria-label="Recusar pedido de amizade" className="w-11 h-11 focus-ring rounded-full bg-destructive/20 text-destructive flex items-center justify-center disabled:opacity-50"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )
      ) : list.length === 0 ? (
        <EstadoVazio
          icone={UserPlus}
          titulo={
            tab === 'discover'
              ? (query.length < 2 ? 'Digite ao menos 2 letras para buscar' : 'Nenhum usuário encontrado')
              : tab === 'following' ? 'Você ainda não segue ninguém' : 'Ninguém te segue ainda'
          }
        />
      ) : (
        <div className="space-y-2">
          {list.map(p => {
            const mutualCount = mutualCounts[p.id] || 0;
            return (
              <div key={p.id} className="flex items-center gap-3 glass rounded-xl p-3 hover:border-primary/40 transition-colors">
                <Link to={`/m/perfil/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground font-bold shrink-0">
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : (p.display_name?.[0]?.toUpperCase() || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.display_name || 'Usuário'}</p>
                    {p.username && <p className="text-xs text-muted-foreground truncate">@{p.username}</p>}
                    {/* GAP-1056: Amigos em comum */}
                    {mutualCount > 0 && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users2 className="h-3 w-3" /> {mutualCount} {mutualCount === 1 ? 'amigo em comum' : 'amigos em comum'}
                      </p>
                    )}
                  </div>
                </Link>
                <FollowBtn targetId={p.id} initiallyFollowing={followingSet.has(p.id)} onChange={(v) => handleFollowChange(p.id, v)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}