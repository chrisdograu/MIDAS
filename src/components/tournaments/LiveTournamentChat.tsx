import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Search, X, ChevronUp, Loader2, Users, AtSign, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from '@/hooks/useDebounce';
import { dbWrite } from '@/lib/dbWrite';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Msg {
  id: string; user_id: string; content: string; kind: string;
  created_at: string; match_id?: string | null; payload?: any;
}
interface Profile { id: string; display_name: string | null; avatar_url: string | null }

const HYPE_EMOJIS = ['🔥', '⚡', '👑', '💥', '🎯', '😱'];
const PAGE = 50;

// GAP-LC03: Parse de menções
function parseMentions(text: string, profiles: Record<string, Profile>): { text: string; mentions: string[] } {
  const mentionRegex = /@(\w+)/g;
  const matches = text.matchAll(mentionRegex);
  const mentions: string[] = [];
  let parsed = text;
  for (const match of matches) {
    const username = match[1];
    const profile = Object.values(profiles).find(p => p.display_name === username || p.id === username);
    if (profile) {
      mentions.push(profile.id);
      parsed = parsed.replace(match[0], `<span class="text-primary font-semibold">@${profile.display_name}</span>`);
    }
  }
  return { text: parsed, mentions };
}

export default function LiveTournamentChat({ tournamentId, matchId }: { tournamentId: string; matchId?: string }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // GAP-LC01: Digitando
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  // GAP-LC04: Participantes ativos
  const [activeUsers, setActiveUsers] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dq = useDebounce(search, 250);

  // GAP-LC01: Broadcast de digitação
  const broadcastTyping = useCallback(async (isTyping: boolean) => {
    if (!user) return;
    // Reusa um único canal — não cria um novo a cada tecla
    const channel = supabase.channel(`typing-send-${tournamentId}`);
    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id, isTyping }
    });
    // Cleanup imediato após o envio (não deixa canal aberto)
    setTimeout(() => { supabase.removeChannel(channel); }, 100);
  }, [tournamentId, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`typing-${tournamentId}`);
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.user_id === user.id) return;
      if (payload.isTyping) {
        setTypingUsers(prev => new Set(prev).add(payload.user_id));
      } else {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(payload.user_id);
          return next;
        });
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, user]);

  // GAP-LC04: Atualizar participantes ativos
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`presence-${tournamentId}`);
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = new Set<string>();
      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: any) => users.add(p.user_id));
      });
      setActiveUsers(users);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: user.id, user_name: user.user_metadata?.full_name || 'Usuário' });
      }
    });
    return () => { supabase.removeChannel(channel); };
  }, [tournamentId, user]);

  const hydrateProfiles = useCallback(async (items: Msg[]) => {
    const ids = [...new Set(items.map(m => m.user_id))].filter(id => !profiles[id]);
    if (!ids.length) return;
    const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids);
    setProfiles(prev => ({ ...prev, ...Object.fromEntries((profs || []).map(p => [p.id, p as Profile])) }));
  }, [profiles]);

  const loadPage = useCallback(async (before?: string) => {
    let q = supabase.from('tournament_chat_messages' as any).select('*')
      .eq('tournament_id', tournamentId).order('created_at', { ascending: false }).limit(PAGE);
    if (matchId) q = q.eq('match_id', matchId);
    if (before) q = q.lt('created_at', before);
    const { data } = await q;
    const items = ((data as any) || []).reverse() as Msg[];
    return items;
  }, [tournamentId, matchId]);

  // Carga inicial + realtime
  useEffect(() => {
    let mounted = true;
    (async () => {
      const items = await loadPage();
      if (!mounted) return;
      setMsgs(items); setHasMore(items.length === PAGE);
      await hydrateProfiles(items);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    })();
    const ch = supabase.channel(`tournament-chat-${tournamentId}-${matchId || 'all'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_chat_messages', filter: `tournament_id=eq.${tournamentId}` },
        async (payload) => {
          const m = payload.new as Msg;
          if (matchId && m.match_id !== matchId) return;
          setMsgs(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
          await hydrateProfiles([m]);
        })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [tournamentId, matchId, loadPage, hydrateProfiles]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || msgs.length === 0) return;
    setLoadingMore(true);
    const el = scrollRef.current; const prevHeight = el?.scrollHeight || 0;
    const older = await loadPage(msgs[0].created_at);
    setMsgs(prev => [...older, ...prev]);
    setHasMore(older.length === PAGE);
    await hydrateProfiles(older);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
    setLoadingMore(false);
  };

  const send = async (kind: string = 'message', content?: string) => {
    if (!user) return;
    const body = content ?? text.trim();
    if (!body) return;
    
    // GAP-LC03: Parse menções
    const { text: parsedText, mentions } = parseMentions(body, profiles);
    
    const ok = await dbWrite(supabase.from('tournament_chat_messages' as any).insert({
      tournament_id: tournamentId, match_id: matchId || null, user_id: user.id, kind, content: body,
      mentions: mentions.length > 0 ? mentions : null,
    }), 'Não foi possível enviar a mensagem');
    if (!ok) return;
    if (kind === 'message') setText('');
  };

  // GAP-LC02: Comandos rápidos
  const handleCommand = useCallback(async (cmd: string) => {
    const [command, ...args] = cmd.split(' ');
    switch (command) {
      case '/hype':
        const emoji = args[0] || '🔥';
        await send('hype', emoji);
        break;
      case '/vote':
        await send('message', `📊 Votação iniciada: ${args.join(' ') || '?'}`);
        break;
      case '/help':
        toast.info('Comandos: /hype [emoji], /vote [assunto]');
        break;
      default:
        toast.info(`Comando desconhecido: ${command}`);
    }
  }, [send]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.startsWith('/')) {
        handleCommand(text);
      } else {
        send();
      }
    }
  };

  const visible = dq.trim()
    ? msgs.filter(m => m.content.toLowerCase().includes(dq.trim().toLowerCase()))
    : msgs;

  const typingList = Array.from(typingUsers).map(id => profiles[id]?.display_name || 'Alguém').filter(Boolean);

  return (
    <div className="flex flex-col bg-card/40 backdrop-blur-md border border-border/60 rounded-xl overflow-hidden h-[480px]">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between bg-gradient-to-r from-destructive/10 to-warning/10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
          </span>
          <span className="text-xs font-bold tracking-[0.2em] uppercase">Chat ao vivo</span>
          {/* GAP-LC04: Participantes ativos */}
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> {activeUsers.size}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSearch(s => !s)} className="text-muted-foreground hover:text-foreground">
            {showSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          <span className="text-[10px] text-muted-foreground">{visible.length}/{msgs.length}</span>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="px-3 py-2 border-b border-border/60 bg-background/40">
          <Input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar mensagens..." className="h-8 text-xs" />
        </div>
      )}

      {/* GAP-LC01: Indicador de digitando */}
      <AnimatePresence>
        {typingList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-3 py-1 text-[10px] text-muted-foreground border-b border-border/40 bg-background/20"
          >
            {typingList.join(', ')} {typingList.length === 1 ? 'está' : 'estão'} digitando...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {hasMore && !dq.trim() && (
          <button onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore}
            className="w-full text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 py-1.5 disabled:opacity-60">
            {loadingMore
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Carregando…</>
              : <><ChevronUp className="h-3 w-3" /> Carregar mensagens antigas</>}
          </button>
        )}
        
        <AnimatePresence initial={false}>
          {visible.map(m => {
            const p = profiles[m.user_id];
            const isHype = m.kind === 'hype';
            const isCommand = m.content.startsWith('/');
            
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "flex gap-2 items-start text-sm",
                  isHype ? 'bg-warning/10 border border-warning/30 rounded-lg px-2 py-1' : '',
                  isCommand ? 'bg-secondary/30 border border-border/40 rounded-lg px-2 py-1' : ''
                )}
              >
                {p?.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" loading="lazy" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-primary mr-1.5">{p?.display_name || '...'}</span>
                  <span className={cn(
                    "break-words",
                    isHype ? 'text-warning font-bold text-base' : 
                    isCommand ? 'text-muted-foreground font-mono text-xs' : 
                    'text-foreground/90'
                  )}>
                    {m.content}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {visible.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">
            {dq.trim() ? 'Nada encontrado.' : 'Seja o primeiro a animar!'}
          </p>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/60 p-2 space-y-2 bg-background/40">
        <div className="flex gap-1 justify-center">
          {HYPE_EMOJIS.map(e => (
            <button key={e} onClick={() => send('hype', e)} className="text-lg hover:scale-125 transition-transform">{e}</button>
          ))}
          {/* GAP-LC02: Comandos rápidos */}
          <button 
            onClick={() => handleCommand('/help')} 
            className="text-xs text-muted-foreground hover:text-primary p-1 rounded"
            title="Comandos: /hype, /vote"
          >
            <Command className="h-4 w-4" />
          </button>
        </div>
        
        {user ? (
          <form onSubmit={(e) => { e.preventDefault(); if (text.startsWith('/')) handleCommand(text); else send(); }} className="flex gap-2">
            <Input 
              value={text} 
              onChange={(e) => {
                setText(e.target.value);
                // GAP-LC01: Broadcast de digitação
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                broadcastTyping(true);
                typingTimeoutRef.current = setTimeout(() => broadcastTyping(false), 1000);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem... (/hype, /vote)"
              maxLength={200} 
              className="h-9 text-sm" 
            />
            <Button type="submit" size="sm" disabled={!text.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <p className="text-xs text-center text-muted-foreground py-1">Entre para participar do chat</p>
        )}
      </div>
    </div>
  );
}