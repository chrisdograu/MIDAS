import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Search, MessagesSquare, Check, X, Trophy, ShieldAlert, Users, Store, Star, Archive, Inbox, UsersRound, Bell, BellOff, CheckCheck } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { timeAgo } from '@/mobile/lib/time';
import { MobileBadge } from '@/mobile/lib/badge';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';

interface Conv {
  id: string; participant_1: string; participant_2: string; anuncio_id: string | null;
  last_message: string | null; last_message_at: string | null; status: string;
  other_id: string; other_name: string; other_avatar: string | null;
  unread: number; ad_title: string | null;
  tournament_id: string | null; is_admin_chat: boolean; tournament_title: string | null;
  favorited: boolean; archived: boolean; muted: boolean;
  channel: 'personal' | 'seller' | null;
}

type Filter = 'all' | 'favorites' | 'unread' | 'archived';

// GAP-1009: Indicador de "digitando..."
function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse py-1 px-2 bg-secondary/30 rounded-lg">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </span>
      <span>{users.length} {users.length === 1 ? 'pessoa está' : 'pessoas estão'} digitando...</span>
    </div>
  );
}

function getConversationPreview(conv: Conv) {
  const raw = (conv.last_message || '').trim();
  if (!raw) return conv.status === 'pending' ? 'quer iniciar uma conversa' : 'Sem mensagens ainda';
  if (raw === '[imagem]') return '📷 Imagem';
  if (raw === '[gif]') return '🎞️ GIF';
  if (/^sistema:/i.test(raw)) return raw.replace(/^sistema:\s*/i, '');
  return raw;
}

export default function MChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversas, setConversas] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'amigos' | 'vendedores' | 'torneios'>('amigos');
  const [filter, setFilter] = useState<Filter>('all');
  const [searchProfiles, setSearchProfiles] = useState<any[]>([]);
  
  // GAP-1009: Estado de "digitando..."
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  // GAP-1010: Marcar todas como lidas
  const [markingAll, setMarkingAll] = useState(false);
  
  // GAP-1012: Seleção múltipla para arquivar
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const applyConversationState = async (convs: any[]) => {
    const otherIds = convs.map(c => c.participant_1 === user?.id ? c.participant_2 : c.participant_1);
    const adIds = convs.map(c => c.anuncio_id).filter(Boolean) as string[];
    const tIds = [...new Set(convs.map(c => c.tournament_id).filter(Boolean) as string[])];
    const convIds = convs.map(c => c.id);
    const [{ data: profiles }, { data: ads }, { data: unread }, { data: tourns }, { data: settings }] = await Promise.all([
      otherIds.length ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', otherIds) : Promise.resolve({ data: [] }),
      adIds.length ? supabase.from('anuncios').select('id, title').in('id', adIds) : Promise.resolve({ data: [] }),
      user ? supabase.from('mensagens').select('sender_id').eq('receiver_id', user.id).eq('is_read', false).is('group_id', null).is('tournament_id', null) : Promise.resolve({ data: [] }),
      tIds.length ? supabase.from('tournaments' as any).select('id, title').in('id', tIds) : Promise.resolve({ data: [] }),
      user && convIds.length ? supabase.from('conversation_settings').select('conversation_id, favorited, archived, muted').eq('user_id', user.id).in('conversation_id', convIds) : Promise.resolve({ data: [] }),
    ]);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const adMap = new Map((ads || []).map(a => [a.id, a.title]));
    const tournMap = new Map(((tourns as any) || []).map((t: any) => [t.id, t.title]));
    const settingsMap = new Map(((settings as any) || []).map((s: any) => [s.conversation_id, s]));
    const unreadMap = new Map<string, number>();
    (unread || []).forEach(m => unreadMap.set(m.sender_id, (unreadMap.get(m.sender_id) || 0) + 1));

    setConversas(convs.map(c => {
      const otherId = c.participant_1 === user?.id ? c.participant_2 : c.participant_1;
      const p = profileMap.get(otherId);
      const s = settingsMap.get(c.id) as any;
      return {
        id: c.id, participant_1: c.participant_1, participant_2: c.participant_2,
        anuncio_id: c.anuncio_id, last_message: c.last_message, last_message_at: c.last_message_at,
        status: c.status || 'accepted',
        other_id: otherId, other_name: p?.display_name || 'Usuário', other_avatar: p?.avatar_url || null,
        unread: unreadMap.get(otherId) || 0, ad_title: c.anuncio_id ? adMap.get(c.anuncio_id) || null : null,
        tournament_id: c.tournament_id || null,
        is_admin_chat: !!c.is_admin_chat,
        tournament_title: c.tournament_id ? (tournMap.get(c.tournament_id) as string) || null : null,
        favorited: !!s?.favorited, archived: !!s?.archived, muted: !!s?.muted,
        channel: (c as any).channel ?? null,
      };
    }));
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: convs } = await supabase
      .from('conversas').select('id, participant_1, participant_2, anuncio_id, last_message, last_message_at, status, tournament_id, is_admin_chat, channel')
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (!convs) { setLoading(false); return; }
    await applyConversationState(convs as any[]);
    setLoading(false);
  };

  // GAP-1009: Escutar "digitando..."
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('typing-status')
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { senderId } = payload.payload;
        if (senderId !== user.id) {
          setTypingUsers(prev => [...prev, senderId]);
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(id => id !== senderId));
          }, 3000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    load();
    const ch = supabase.channel(`chat-list-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas', filter: `participant_1=eq.${user.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas', filter: `participant_2=eq.${user.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens', filter: `receiver_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // GAP-1010: Marcar todas como lidas
  const markAllAsRead = async () => {
    if (!user) return;
    setMarkingAll(true);
    const unreadIds = conversas.filter(c => c.unread > 0).map(c => c.id);
    if (unreadIds.length === 0) {
      toast.info('Nenhuma mensagem não lida');
      setMarkingAll(false);
      return;
    }
    const { error } = await supabase
      .from('mensagens')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .is('group_id', null)
      .is('tournament_id', null)
      .eq('is_read', false);
    setMarkingAll(false);
    if (error) {
      toast.error('Erro ao marcar como lidas');
      return;
    }
    toast.success(`${unreadIds.length} conversa(s) marcadas como lidas`);
    load();
  };

  // GAP-1012: Arquivo em lote
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const archiveSelected = async () => {
    if (selectedIds.size === 0) return;
    const inserts = [...selectedIds].map(convId => ({
      user_id: user!.id,
      conversation_id: convId,
      archived: true,
      favorited: false,
      muted: false,
    }));
    const { error } = await supabase
      .from('conversation_settings')
      .upsert(inserts, { onConflict: 'user_id, conversation_id' });
    if (error) {
      toast.error('Erro ao arquivar');
      return;
    }
    toast.success(`${selectedIds.size} conversa(s) arquivadas`);
    setSelectedIds(new Set());
    setSelectMode(false);
    load();
  };

  const handleAccept = async (id: string) => {
    const ok = await dbWrite(
      supabase.from('conversas').update({ status: 'accepted' }).eq('id', id),
      'Não foi possível aceitar a conversa',
    );
    if (!ok) return;
    toast.success('Conversa aceita');
    load();
  };
  const handleReject = async (id: string) => {
    const ok = await dbWrite(
      supabase.from('conversas').update({ status: 'rejected' }).eq('id', id),
      'Não foi possível recusar a conversa',
    );
    if (!ok) return;
    toast('Conversa recusada');
    load();
  };

  if (!user) {
    return (
      <div className="px-6 py-12 text-center">
        <MessagesSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground mb-4">Entre para acessar suas conversas.</p>
        <Link to="/m/auth" className="inline-block px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Entrar</Link>
      </div>
    );
  }

  const pending = conversas.filter(c => c.status === 'pending' && c.participant_2 === user.id);
  const active = conversas.filter(c => c.status === 'accepted');
  const tournamentConvs = active.filter(c => c.tournament_id);
  const sellerCh = (c: Conv) => c.channel === 'seller' || (!c.channel && !!c.anuncio_id);
  const personalCh = (c: Conv) => c.channel === 'personal' || (!c.channel && !c.anuncio_id);
  const vendorConvs = active.filter(c => !c.tournament_id && sellerCh(c));
  const friendsConvs = active.filter(c => !c.tournament_id && personalCh(c));
  const tournamentUnread = tournamentConvs.reduce((s, c) => s + c.unread, 0);
  const vendorUnread = vendorConvs.reduce((s, c) => s + c.unread, 0);
  const friendsUnread = friendsConvs.reduce((s, c) => s + c.unread, 0);

  const tournamentGroups = tournamentConvs.reduce<Record<string, Conv[]>>((acc, c) => {
    const k = c.tournament_id!;
    (acc[k] = acc[k] || []).push(c);
    return acc;
  }, {});

  const list = tab === 'torneios' ? tournamentConvs : tab === 'vendedores' ? vendorConvs : friendsConvs;
  
  // GAP-1011: Ordenação por favoritos primeiro
  const sortedList = [...list].sort((a, b) => {
    if (a.favorited && !b.favorited) return -1;
    if (!a.favorited && b.favorited) return 1;
    return 0;
  });
  
  const byFilter = sortedList.filter(c => {
    if (filter === 'favorites') return c.favorited;
    if (filter === 'unread') return c.unread > 0;
    if (filter === 'archived') return c.archived;
    return !c.archived;
  });
  const filtered = byFilter.filter(c => !query.trim() || c.other_name.toLowerCase().includes(query.toLowerCase()) || (c.tournament_title || '').toLowerCase().includes(query.toLowerCase()) || (c.ad_title || '').toLowerCase().includes(query.toLowerCase()));

  const isSocialSearch = query.trim().startsWith('@') && query.trim().length > 1;
  const hasUnread = conversas.some(c => c.unread > 0);

  return (
    <div className="h-full overflow-hidden px-4 py-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold gradient-text">Chat</h1>
        <div className="flex items-center gap-2">
          {/* GAP-1010: Marcar todas como lidas */}
          {hasUnread && (
            <button
              onClick={markAllAsRead}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Marcar lidas
            </button>
          )}
          <Link to="/m/grupos" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold hover:border-primary/40">
            <UsersRound className="h-3.5 w-3.5 text-primary" /> Grupos
          </Link>
        </div>
      </div>

      {/* GAP-1009: Indicador de "digitando..." */}
      <TypingIndicator users={typingUsers} />

      <div className="flex gap-1 p-1 bg-card border border-border rounded-xl">
        <button onClick={() => setTab('amigos')} className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1 ${tab === 'amigos' ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md' : 'text-muted-foreground'}`}>
          <Users className="h-3.5 w-3.5" /> Amigos
          {friendsUnread > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">{friendsUnread}</span>}
        </button>
        <button onClick={() => setTab('vendedores')} className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1 ${tab === 'vendedores' ? 'bg-gradient-to-r from-warning to-warning text-on-media shadow-md' : 'text-muted-foreground'}`}>
          <Store className="h-3.5 w-3.5" /> Vendedores
          {vendorUnread > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">{vendorUnread}</span>}
        </button>
        <button onClick={() => setTab('torneios')} className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1 ${tab === 'torneios' ? 'bg-gradient-to-r from-destructive to-accent text-primary-foreground shadow-md' : 'text-muted-foreground'}`}>
          <Trophy className="h-3.5 w-3.5" /> Torneios
          {tournamentUnread > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">{tournamentUnread}</span>}
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
        {([
          { id: 'all', label: 'Todos', Icon: Inbox },
          { id: 'favorites', label: 'Favoritos', Icon: Star },
          { id: 'unread', label: 'Não lidos', Icon: MessagesSquare },
          { id: 'archived', label: 'Arquivados', Icon: Archive },
        ] as { id: Filter; label: string; Icon: any }[]).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap flex items-center gap-1 ${filter === f.id ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}>
            <f.Icon className="h-3 w-3" /> {f.label}
          </button>
        ))}
        {/* GAP-1012: Modo de seleção múltipla */}
        <button
          onClick={() => {
            setSelectMode(!selectMode);
            if (selectMode) setSelectedIds(new Set());
          }}
          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${selectMode ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}
        >
          {selectMode ? '✕ Cancelar' : '☑ Selecionar'}
        </button>
        {selectMode && selectedIds.size > 0 && (
          <button
            onClick={archiveSelected}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap bg-warning text-warning-foreground"
          >
            Arquivar ({selectedIds.size})
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query} onChange={async e => {
            const v = e.target.value;
            setQuery(v);
            if (v.startsWith('@') && v.length > 2) {
              const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').ilike('display_name', `${v.slice(1)}%`).limit(8);
              setSearchProfiles(data || []);
            } else setSearchProfiles([]);
          }}
          placeholder={'Buscar conversas... (@ para usuários)'}
          className="w-full pl-10 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        {isSocialSearch && searchProfiles.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 glass rounded-xl p-2 z-30 max-h-64 overflow-y-auto">
            <p className="text-[10px] uppercase text-muted-foreground px-2 mb-1">Pesquisa social</p>
            {searchProfiles.map(p => (
              <Link key={p.id} to={`/m/perfil/${p.id}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-card">
                {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" loading="lazy" /> : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-bold text-primary-foreground">{p.display_name?.[0]?.toUpperCase()}</div>}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.display_name}</p>
                  <p className="text-[10px] text-muted-foreground">@{(p.display_name || '').toLowerCase()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {tab === 'amigos' && pending.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-warning mb-2">Pedidos de conversa ({pending.length})</h2>
              <div className="space-y-2">
                {pending.map(c => (
                  <div key={c.id} className="glass rounded-xl p-3 flex items-start gap-3">
                    <Avatar name={c.other_name} url={c.other_avatar} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.other_name}</p>
                      <p className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{getConversationPreview(c)}</p>
                    </div>
                    <button onClick={() => handleAccept(c.id)} className="w-11 h-11 focus-ring rounded-full bg-success/20 text-success flex items-center justify-center"><Check className="h-4 w-4" /></button>
                    <button onClick={() => handleReject(c.id)} className="w-11 h-11 focus-ring rounded-full bg-destructive/20 text-destructive flex items-center justify-center"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'torneios' ? (
            tournamentConvs.length === 0 ? (
              <EstadoVazio
                icone={Trophy}
                titulo="Nenhum chat de torneio"
                descricao="Inscreva-se em um torneio para conversar com adversários e admins."
              />
            ) : (
              <div className="space-y-4">
                {Object.entries(tournamentGroups).map(([tid, convs]) => {
                  const title = convs[0].tournament_title || 'Torneio';
                  const visible = convs.filter(c => filtered.includes(c));
                  if (visible.length === 0) return null;
                  return (
                    <section key={tid} className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <Trophy className="h-4 w-4 text-destructive" />
                        <h2 className="text-xs font-bold uppercase tracking-wider gradient-text truncate flex-1">{title}</h2>
                        <span className="text-[10px] text-muted-foreground">{visible.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {visible.map(c => (
                          <Link key={c.id} to={`/m/chat/${c.id}`} className={`relative flex items-start gap-3 p-3 glass rounded-xl border-l-2 ${c.favorited ? 'border-primary' : 'border-destructive/60'} hover:border-primary transition-all overflow-hidden ${selectMode ? 'cursor-pointer' : ''}`} onClick={() => selectMode ? toggleSelect(c.id) : null}>
                            {selectMode && (
                              <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => {}} className="mt-1 h-4 w-4 accent-primary" />
                            )}
                            <Avatar name={c.other_name} url={c.other_avatar} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <p className="min-w-0 flex items-center gap-1.5 overflow-hidden text-sm font-semibold">
                                  {c.is_admin_chat && <ShieldAlert className="h-3 w-3 text-warning shrink-0" />}
                                  <span className="truncate">{c.other_name}</span>
                                </p>
                                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(c.last_message_at)}</span>
                              </div>
                              {c.is_admin_chat && <MobileBadge tone="warning">Admin</MobileBadge>}
                              <p className="mt-0.5 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{getConversationPreview(c)}</p>
                            </div>
                            {c.unread > 0 && <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{c.unread > 9 ? '9+' : c.unread}</span>}
                          </Link>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )
          ) : filtered.length === 0 ? (
            <EstadoVazio
              icone={tab === 'vendedores' ? Store : MessagesSquare}
              titulo={tab === 'vendedores' ? 'Nenhum chat de vendedor' : 'Nenhuma conversa ainda'}
              descricao={tab === 'vendedores' ? 'Conversas iniciadas a partir de anúncios aparecem aqui.' : 'Inicie uma conversa pelo Fórum ou pelo perfil de um amigo.'}
              acao={{ label: tab === 'vendedores' ? 'Ver marketplace' : 'Ir ao fórum', to: tab === 'vendedores' ? '/m/marketplace' : '/m/forum' }}
            />
          ) : (
            <div className="space-y-1.5">
              {filtered.map(c => (
                <Link key={c.id} to={`/m/chat/${c.id}`} className={`relative flex items-start gap-3 p-3 glass rounded-xl hover:border-primary/40 transition-colors overflow-hidden ${c.favorited ? 'border-l-2 border-primary' : ''} ${selectMode ? 'cursor-pointer' : ''}`} onClick={() => selectMode ? toggleSelect(c.id) : null}>
                  {selectMode && (
                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => {}} className="mt-1 h-4 w-4 accent-primary" />
                  )}
                  <Avatar name={c.other_name} url={c.other_avatar} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.other_name}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(c.last_message_at)}</span>
                    </div>
                    {c.ad_title && <div className="max-w-full overflow-hidden"><MobileBadge tone="primary">📦 {c.ad_title.slice(0, 30)}</MobileBadge></div>}
                    <p className="mt-0.5 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{getConversationPreview(c)}</p>
                  </div>
                  {c.favorited && !selectMode && <Star className="absolute top-2 right-2 h-3.5 w-3.5 text-primary fill-primary" />}
                  {c.unread > 0 && <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{c.unread > 9 ? '9+' : c.unread}</span>}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground font-bold shrink-0">
      {url ? <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" /> : name[0]?.toUpperCase() || '?'}
    </div>
  );
}