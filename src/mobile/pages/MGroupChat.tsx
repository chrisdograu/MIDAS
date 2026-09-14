import { useEffect, useRef, useState, useMemo } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, Settings, Users, Trash2, Crown, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MentionText } from '@/mobile/components/MentionText';
import { recordMentions } from '@/mobile/lib/mentions';
import EstadoVazio from '@/components/EstadoVazio';
import { formatTime } from '@/lib/format';

interface Msg { id: string; sender_id: string; content: string; created_at: string; }
interface Member { user_id: string; role: 'admin'|'member'|'observer'; display_name: string | null; avatar_url: string | null; }

// GAP-1059: Indicador de "digitando..." com avatares
function TypingIndicator({ users, memberMap }: { users: string[]; memberMap: Map<string, Member> }) {
  if (users.length === 0) return null;
  
  const members = users
    .map(id => memberMap.get(id))
    .filter(Boolean) as Member[];
  
  const displayNames = members.map(m => m.display_name || 'Alguém');
  
  const visibleAvatars = members.slice(0, 3);
  const remaining = members.length - 3;
  
  let text = '';
  if (members.length === 1) {
    text = `${displayNames[0]} está digitando...`;
  } else if (members.length === 2) {
    text = `${displayNames[0]} e ${displayNames[1]} estão digitando...`;
  } else if (members.length === 3) {
    text = `${displayNames[0]}, ${displayNames[1]} e ${displayNames[2]} estão digitando...`;
  } else {
    text = `${displayNames[0]}, ${displayNames[1]} e +${remaining} outros estão digitando...`;
  }
  
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-1.5 px-2 bg-card/50 rounded-lg">
      <div className="flex -space-x-1.5">
        {visibleAvatars.map((m, i) => (
          <div
            key={m.user_id}
            className="w-6 h-6 rounded-full border-2 border-background bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-[8px] font-bold text-primary-foreground"
            style={{ zIndex: visibleAvatars.length - i }}
          >
            {m.avatar_url ? (
              <img src={m.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              m.display_name?.[0]?.toUpperCase() || '?'
            )}
          </div>
        ))}
        {remaining > 0 && (
          <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
            +{remaining}
          </div>
        )}
      </div>
      <span className="animate-pulse">⋯ {text}</span>
    </div>
  );
}

export default function MGroupChat() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  
  // GAP-1059: "digitando..."
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const memberMap = useMemo(() => new Map(members.map(m => [m.user_id, m])), [members]);

  // GAP-1059: Enviar sinal de "digitando..."
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const sendTyping = () => {
    if (!user || !id) return;
    // Debounce: envia no máximo 1x por 1s
    if (typingDebounceRef.current) return;
    typingDebounceRef.current = setTimeout(() => { typingDebounceRef.current = null; }, 1000);
    // Usa RPC para array_append (não sobrescreve outros digitando)
    void supabase.rpc('set_typing' as any, { _group_id: id, _user_id: user.id, _typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      void supabase.rpc('set_typing' as any, { _group_id: id, _user_id: user.id, _typing: false });
    }, 2500);
  };

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data: g } = await supabase.from('groups').select('*').eq('id', id).maybeSingle();
      if (!g) { setLoading(false); return; }
      setGroup(g);
      await loadMembers();
      await loadMsgs();
      setLoading(false);
    })();
    
    // GAP-1059: Escutar "digitando..."
    const typingChannel = supabase
      .channel(`typing-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'groups',
        filter: `id=eq.${id}`,
      }, (payload) => {
        const typing = (payload.new as any)?.typing_users || [];
        setTypingUsers(typing.filter((uid: string) => uid !== user.id));
      })
      .subscribe();

    const ch = supabase.channel(`mg-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens', filter: `group_id=eq.${id}` }, loadMsgs)
      .subscribe();
    return () => { 
      supabase.removeChannel(ch);
      supabase.removeChannel(typingChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    };
  }, [user?.id, id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const loadMembers = async () => {
    const { data } = await supabase.from('group_members')
      .select('user_id, role, profiles:user_id(display_name, avatar_url)')
      .eq('group_id', id!);
    setMembers(((data as any) || []).map((m: any) => ({
      user_id: m.user_id, role: m.role,
      display_name: m.profiles?.display_name, avatar_url: m.profiles?.avatar_url,
    })));
  };

  const loadMsgs = async () => {
    const { data } = await supabase.from('mensagens')
      .select('id, sender_id, content, created_at')
      .eq('group_id', id!).order('created_at', { ascending: true }).limit(200);
    setMsgs((data as any) || []);
  };

  const myRole = members.find(m => m.user_id === user?.id)?.role;
  const isAdmin = myRole === 'admin';
  const isDisabled = !!(group as any)?.is_disabled;
  const canSend = (myRole === 'admin' || myRole === 'member') && !isDisabled;

  const send = async () => {
    if (!text.trim() || !user || !canSend || sending) return;
    // Parar de digitar
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    void supabase.rpc('set_typing' as any, { _group_id: id, _user_id: user.id, _typing: false });
    
    setSending(true);
    const content = text.trim();
    setText('');
    const { data: inserted, error } = await supabase.from('mensagens').insert({
      sender_id: user.id, receiver_id: user.id,
      content, group_id: id!, message_type: 'text', is_read: true,
    } as any).select('id').single();
    if (error) { toast.error(error.message); setSending(false); return; }
    if (inserted) recordMentions({ text: content, mentionedBy: user.id, sourceType: 'group_message', sourceId: inserted.id });
    setSending(false);
  };

  const deleteMsg = async (mid: string) => {
    if (!isAdmin) return;
    if (!confirm('Excluir mensagem?')) return;
    const { error } = await supabase.from('mensagens').delete().eq('id', mid);
    if (error) toast.error(`Não foi possível excluir a mensagem: ${error.message}`);
  };

  if (!user) return <Navigate to="/m/auth" replace />;
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!group) return <div className="p-6 text-center text-muted-foreground">Grupo não encontrado</div>;

  const threadHeight = 'calc(100dvh - 57px - 56px - env(safe-area-inset-bottom))';

  return (
    <div className="flex flex-col overflow-hidden bg-background" style={{ height: threadHeight }}>
      <header className="shrink-0 backdrop-blur-xl bg-background/80 border-b border-border/50 px-3 py-2 flex items-center gap-3">
        <button onClick={() => navigate('/m/grupos')} className="p-1"><ArrowLeft className="h-5 w-5" /></button>
        <Link to={`/m/grupos/${id}/info`} className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            {group.image_url ? <img src={group.image_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Users className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{group.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{members.length} membros</p>
          </div>
        </Link>
        <Link to={`/m/grupos/${id}/info`} className="p-2"><Settings className="h-4 w-4 text-muted-foreground" /></Link>
      </header>

      {/* GAP-1059: Indicador de "digitando..." com avatares */}
      <TypingIndicator users={typingUsers} memberMap={memberMap} />

      <div className="flex-1 min-h-0 px-3 py-3 space-y-2 overflow-y-auto">
        {msgs.length === 0 && (
          <EstadoVazio icone={Users} titulo="Quebre o gelo!" descricao="Envie a primeira mensagem para o grupo." />
        )}
        {msgs.map(m => {
          const own = m.sender_id === user.id;
          const sender = memberMap.get(m.sender_id);
          return (
            <div key={m.id} className={`group flex ${own ? 'justify-end' : 'justify-start'} gap-2`}>
              {!own && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground text-[10px] font-bold shrink-0">
                  {sender?.avatar_url ? <img src={sender.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : (sender?.display_name?.[0]?.toUpperCase() || '?')}
                </div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${own ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card text-foreground rounded-bl-sm border border-border/50'}`}>
                {!own && (
                  <p className="text-[10px] font-semibold opacity-80 flex items-center gap-1">
                    {sender?.display_name || 'Usuário'}
                    {sender?.role === 'admin' && <Crown className="h-2.5 w-2.5 text-warning" />}
                    {sender?.role === 'observer' && <Eye className="h-2.5 w-2.5" />}
                  </p>
                )}
                <MentionText text={m.content} className="text-sm whitespace-pre-wrap break-words" />
                <p className={`text-[9px] mt-0.5 ${own ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{formatTime(m.created_at)}</p>
              </div>
              {isAdmin && !own && (
                <button onClick={() => deleteMsg(m.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 backdrop-blur-xl bg-background/90 border-t border-border/50 px-2 py-2">
        {isDisabled ? (
          <p className="text-center text-xs text-destructive py-2">
            Este grupo foi desativado pela moderação e não recebe novas mensagens.
          </p>
        ) : !canSend ? (
          <p className="text-center text-xs text-muted-foreground py-2 flex items-center justify-center gap-1.5">
            <Eye className="h-3 w-3" /> Você é observador e não pode enviar mensagens.
          </p>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              value={text} onChange={e => {
                setText(e.target.value);
                sendTyping();
              }}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Mensagem (use @ para mencionar)..." maxLength={1000}
              className="flex-1 px-3 py-2.5 bg-card border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button onClick={send} aria-label="Enviar mensagem" disabled={sending || !text.trim()} className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground flex items-center justify-center disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}