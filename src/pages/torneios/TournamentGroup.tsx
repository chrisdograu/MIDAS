import { useEffect, useRef, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Loader2, Send, ShieldCheck, Trash2, VolumeX, UserMinus, Crown, Smile, Image, X, Bell, Check, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { formatTime } from '@/lib/format';
import { dbWrite } from '@/lib/dbWrite';
import { stripImageExif } from '@/lib/stripImageExif';

interface Msg { id: string; sender_id: string; content: string; created_at: string; reactions?: Record<string, string>; image_url?: string | null; read_at?: string | null; }
interface Profile { id: string; display_name: string | null; avatar_url: string | null; }

// GAP-1119: Tipos de reação
type ReactionType = '👍' | '❤️' | '😂' | '😮' | '😢' | '😡';

const REACTION_EMOJIS: ReactionType[] = ['👍', '❤️', '😂', '😮', '😢', '😡'];

// GAP-1117: Componente de "digitando..."
function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse py-1 px-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </span>
      <span>{users.length} {users.length === 1 ? 'pessoa está' : 'pessoas estão'} digitando...</span>
    </div>
  );
}

// GAP-1119: Componente de reações
function ReactionPicker({ onReact, currentReaction }: { onReact: (emoji: ReactionType) => void; currentReaction: ReactionType | null }) {
  const [open, setOpen] = useState(false);
  
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="p-0.5 rounded hover:bg-secondary transition-colors" title="Reagir">
        <Smile className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    );
  }
  
  return (
    <div className="flex items-center gap-0.5 bg-card border border-border rounded-lg p-1 shadow-lg">
      {REACTION_EMOJIS.map((emoji) => (
        <button key={emoji} onClick={() => { onReact(emoji); setOpen(false); }} className={`p-1 rounded hover:bg-secondary transition-colors text-base ${currentReaction === emoji ? 'bg-primary/10 ring-1 ring-primary' : ''}`}>
          {emoji}
        </button>
      ))}
      <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-secondary transition-colors text-xs text-muted-foreground">✕</button>
    </div>
  );
}

// GAP-1118: Notificação de nova mensagem
function useMessageNotifications(messages: Msg[], userId: string | undefined) {
  const [lastMessageCount, setLastMessageCount] = useState(messages.length);
  const [hasNew, setHasNew] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > lastMessageCount) {
      const newMessages = messages.slice(lastMessageCount);
      const hasOthers = newMessages.some(m => m.sender_id !== userId);
      if (hasOthers) {
        setHasNew(true);
        // GAP-1118: Notificação visual (toast)
        const count = newMessages.filter(m => m.sender_id !== userId).length;
        toast.info(`📩 ${count} nova(s) mensagem(ns) no grupo`);
      }
    }
    setLastMessageCount(messages.length);
    
    // Auto-scroll se o usuário já estiver no fundo
    if (scrollRef.current) {
      const el = scrollRef.current;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
      if (isAtBottom || messages.length > 0) {
        setTimeout(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [messages, userId]);

  const markRead = () => setHasNew(false);

  return { hasNew, markRead, scrollRef };
}

export default function TournamentGroup() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<any>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [participants, setParticipants] = useState<any[]>([]);
  const [isMod, setIsMod] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { submitting, guard } = useSubmitGuard();
  
  // GAP-1117: Estado de "digitando..."
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // GAP-1118: Notificações
  const { hasNew, markRead, scrollRef } = useMessageNotifications(messages, user?.id);

  // GAP-1119: Reações
  const [reactions, setReactions] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data: t } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle();
      setTournament(t);

      const { data: mods } = await supabase.from('tournament_moderators').select('user_id').eq('tournament_id', id);
      setIsMod(!!mods?.some((m: any) => m.user_id === user.id));

      await loadParticipants();
      await loadMessages();
      setLoading(false);
    })();

    // GAP-1117: Escutar "digitando..."
    const typingChannel = supabase
      .channel(`typing-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${id}`,
      }, (payload) => {
        const typing = (payload.new as any)?.typing_users || [];
        setTypingUsers(typing.filter((uid: string) => uid !== user.id));
      })
      .subscribe();

    const ch = supabase.channel(`tg-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens', filter: `tournament_id=eq.${id}` }, () => loadMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${id}` }, () => loadParticipants())
      .subscribe();
      
    return () => { 
      supabase.removeChannel(ch);
      supabase.removeChannel(typingChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [user, id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase.from('mensagens')
      .select('id, sender_id, content, created_at, reactions, image_url')
      .eq('tournament_id', id!).order('created_at', { ascending: true }).limit(200);
    const msgs = (data as any) || [];
    setMessages(msgs);
    // Carregar reações
    const reactMap: Record<string, Record<string, string>> = {};
    msgs.forEach((m: any) => {
      if (m.reactions) {
        reactMap[m.id] = m.reactions;
      }
    });
    setReactions(reactMap);
    const ids = [...new Set(msgs.map((m: any) => m.sender_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids as any);
      const map: Record<string, Profile> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(prev => ({ ...prev, ...map }));
    }
  };

  const loadParticipants = async () => {
    const { data } = await supabase.from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', id!);
    const ids = ((data as any) || []).map((p: any) => p.user_id);
    let profMap: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids);
      (profs || []).forEach((p: any) => { profMap[p.id] = p; });
    }
    setParticipants(((data as any) || []).map((p: any) => ({ ...p, profiles: profMap[p.user_id] || null })));
  };

  // GAP-1117: Enviar sinal de "digitando..."
  const sendTyping = () => {
    if (!user || !id) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    supabase
      .from('tournaments')
      .update({ typing_users: [...typingUsers, user.id] })
      .eq('id', id)
      .then(() => {});
    typingTimeoutRef.current = setTimeout(() => {
      supabase
        .from('tournaments')
        .update({ typing_users: typingUsers.filter(uid => uid !== user.id) })
        .eq('id', id)
        .then(() => {});
    }, 2000);
  };

  // GAP-1119: Adicionar reação
  const addReaction = async (messageId: string, emoji: ReactionType) => {
    if (!user) return;
    const current = reactions[messageId] || {};
    const userReaction = current[user.id];
    let newReactions = { ...current };
    if (userReaction === emoji) {
      delete newReactions[user.id];
    } else {
      newReactions[user.id] = emoji;
    }
    const { error } = await supabase
      .from('mensagens')
      .update({ reactions: newReactions })
      .eq('id', messageId);
    if (!error) {
      setReactions(prev => ({ ...prev, [messageId]: newReactions }));
    }
  };

  // GAP-1120: Upload de imagem
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas');
      return;
    }
    setImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const send = guard(async () => {
    if (!text.trim() && !imageFile) return;
    if (!user) return;
    
    const { submitting: s, guard: g } = useSubmitGuard();
    let imageUrl = null;
    
    // GAP-1120: Upload da imagem
    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const path = `tournament-chat/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const processed = imageFile.type.startsWith('image/') ? await stripImageExif(imageFile) : imageFile;
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(path, processed);
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);
        imageUrl = publicUrl;
      }
    }
    
    const payload: any = {
      sender_id: user.id,
      receiver_id: user.id,
      content: text.trim() || '📷 Imagem',
      tournament_id: id!,
      message_type: imageUrl ? 'image' : 'text',
    };
    if (imageUrl) {
      payload.image_url = imageUrl;
      payload.content = text.trim() || '📷 Imagem';
    }
    
    const { error } = await supabase.from('mensagens').insert(payload as any);
    if (error) { toast.error(error.message); return; }
    setText('');
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  });

  const deleteMsg = async (mid: string) => {
    if (!confirm('Excluir esta mensagem? A ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('mensagens').delete().eq('id', mid);
    if (error) toast.error(error.message); else toast.success('Mensagem removida');
  };

  const muteUser = async (uid: string) => {
    const hours = Number(prompt('Silenciar por quantas horas?', '24'));
    if (!hours || hours <= 0) return;
    const until = new Date(Date.now() + hours * 3600000).toISOString();
    const { error } = await supabase.from('tournament_chat_mutes').insert({
      tournament_id: id!, user_id: uid, muted_by: user!.id, muted_until: until,
    } as any);
    if (error) toast.error(error.message); else toast.success(`Silenciado por ${hours}h`);
  };

  const kickUser = async (uid: string) => {
    if (!confirm('Remover este participante do torneio?')) return;
    const { error } = await supabase.from('tournament_participants').delete()
      .eq('tournament_id', id!).eq('user_id', uid);
    if (error) toast.error(error.message); else toast.success('Removido');
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!tournament) return <div className="container mx-auto py-20 text-center text-muted-foreground">Torneio não encontrado</div>;

  const amParticipant = participants.some((p: any) => p.user_id === user.id);
  if (!amParticipant && !isMod) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">Apenas participantes têm acesso ao grupo deste torneio.</p>
        <Link to={`/torneios/${id}`} className="text-primary hover:underline">Voltar ao evento</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <Link to={`/torneios/${id}`} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="h-4 w-4" /> Voltar ao evento
      </Link>
      
      {/* GAP-1118: Badge de novas mensagens */}
      {hasNew && (
        <button onClick={markRead} className="mb-3 w-full p-2 bg-primary/10 border border-primary/30 rounded-lg text-sm text-primary font-medium flex items-center justify-center gap-2 animate-pulse">
          <Bell className="h-4 w-4" /> {messages.filter(m => m.sender_id !== user.id && !m.read_at).length} nova(s) mensagem(ns) — Clique para marcar como lidas
        </button>
      )}
      
      <div className="grid lg:grid-cols-[1fr_280px] gap-4 h-[calc(100vh-180px)]">
        {/* Chat */}
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-bold flex items-center gap-2">{tournament.title} {isMod && <Crown className="h-4 w-4 text-warning" />}</h2>
              <p className="text-xs text-muted-foreground">Grupo de participantes · {participants.length} membros</p>
            </div>
            {isMod && <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded">Moderador</span>}
          </div>
          
          {/* GAP-1117: Indicador de "digitando..." */}
          <TypingIndicator users={typingUsers} />
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Sem mensagens. Quebre o gelo!</p>}
            {messages.map(m => {
              const prof = profiles[m.sender_id];
              const mine = m.sender_id === user.id;
              const msgReactions = reactions[m.id] || {};
              const userReaction = msgReactions[user.id] || null;
              const reactionCounts: Record<string, number> = {};
              Object.values(msgReactions).forEach((emoji: any) => {
                reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
              });
              
              return (
                <div key={m.id} className={`flex gap-2 group ${mine ? 'flex-row-reverse' : ''}`}>
                  <div className={`max-w-[70%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    {!mine && <div className="text-xs font-semibold opacity-80 mb-0.5">{prof?.display_name || 'Usuário'}</div>}
                    {m.image_url && (
                      <img src={m.image_url} alt="Imagem" className="max-w-full rounded-lg mb-1 max-h-48 object-cover" loading="lazy" />
                    )}
                    <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">{formatTime(m.created_at)}</div>
                    
                    {/* GAP-1119: Reações */}
                    {Object.keys(reactionCounts).length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {Object.entries(reactionCounts).map(([emoji, count]) => (
                          <span key={emoji} className="text-xs bg-card/30 rounded-full px-1.5 py-0.5">
                            {emoji} {count}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* GAP-1119: Botão de reação */}
                    <div className="mt-1">
                      <ReactionPicker 
                        onReact={(emoji) => addReaction(m.id, emoji)}
                        currentReaction={userReaction as ReactionType | null}
                      />
                    </div>
                  </div>
                  {isMod && !mine && (
                    <button onClick={() => deleteMsg(m.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* GAP-1120: Input com upload de imagem */}
          <div className="p-3 border-t border-border flex flex-col gap-2">
            {imagePreview && (
              <div className="relative inline-block">
                <img src={imagePreview} alt="Preview" className="max-h-24 rounded-lg border border-border" loading="lazy" />
                <button onClick={removeImage} className="absolute -top-1 -right-1 p-0.5 bg-destructive rounded-full text-destructive-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg border border-border hover:border-primary/40 transition-colors"
                title="Anexar imagem"
              >
                <Image className="h-4 w-4 text-muted-foreground" />
              </button>
              <Input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  sendTyping();
                }}
                placeholder="Mensagem..."
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                className="flex-1"
              />
              <Button onClick={send} disabled={submitting || (!text.trim() && !imageFile)}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Participantes */}
        <aside className="bg-card border border-border rounded-xl p-4 overflow-y-auto">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Participantes</h3>
          <ul className="space-y-2">
            {participants.map((p: any) => (
              <li key={p.user_id} className="flex items-center justify-between text-sm group">
                <Link to={`/amigo/${p.user_id}`} className="flex items-center gap-2 hover:text-primary truncate">
                  {p.profiles?.avatar_url ? (
                    <img src={p.profiles.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" loading="lazy" />
                  ) : <div className="w-6 h-6 rounded-full bg-secondary" />}
                  <span className="truncate">{p.profiles?.display_name || 'Usuário'}</span>
                </Link>
                {isMod && p.user_id !== user.id && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => muteUser(p.user_id)} className="text-muted-foreground hover:text-warning" title="Silenciar"><VolumeX className="h-3.5 w-3.5" /></button>
                    <button onClick={() => kickUser(p.user_id)} className="text-muted-foreground hover:text-destructive" title="Remover"><UserMinus className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}