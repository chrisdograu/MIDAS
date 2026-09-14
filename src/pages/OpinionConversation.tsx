// Rota canônica: /perfil/:userId/jogo/:productId/opniao/:opinionId/conversa/:convId
// Conversa privada permanente vinculada a uma opinião. Opinião original fixa no topo.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Send, Loader2, Lock, BookOpen, Gamepad2, MessageCircle, MoreVertical, Edit2, Trash2, Smile, CheckCheck, Clock } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import EstadoVazio from '@/components/EstadoVazio';
import { dbWrite } from '@/lib/dbWrite';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// GAP-530: Tipos de reação
type ReactionType = '👍' | '❤️' | '😂' | '😮' | '😢' | '😡';

const REACTION_EMOJIS: ReactionType[] = ['👍', '❤️', '😂', '😮', '😢', '😡'];

// GAP-528: Indicador de "digitando..."
function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return null;
  const names = users.join(', ');
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse py-1">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
      </span>
      <span>{names} {users.length === 1 ? 'está' : 'estão'} digitando...</span>
    </div>
  );
}

// GAP-530: Componente de reações
function ReactionPicker({ 
  onReact, 
  currentReaction 
}: { 
  onReact: (emoji: ReactionType) => void; 
  currentReaction: ReactionType | null;
}) {
  const [open, setOpen] = useState(false);
  
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="p-0.5 rounded hover:bg-secondary transition-colors"
        title="Reagir"
      >
        <Smile className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    );
  }
  
  return (
    <div className="flex items-center gap-0.5 bg-card border border-border rounded-lg p-1 shadow-lg">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onReact(emoji);
            setOpen(false);
          }}
          className={`p-1 rounded hover:bg-secondary transition-colors text-base ${
            currentReaction === emoji ? 'bg-primary/10 ring-1 ring-primary' : ''
          }`}
        >
          {emoji}
        </button>
      ))}
      <button
        onClick={() => setOpen(false)}
        className="p-1 rounded hover:bg-secondary transition-colors text-xs text-muted-foreground"
      >
        ✕
      </button>
    </div>
  );
}

export default function OpinionConversation() {
  const { userId, productId, opinionId, convId } = useParams();
  const { user } = useAuth();
  const [opinion, setOpinion] = useState<any>(null);
  const [conv, setConv] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // GAP-528: Estado de "digitando..."
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // GAP-531: Estado para edição/exclusão
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // GAP-529: Marcar mensagens como lidas
  const markAsRead = useCallback(async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;
    const unreadIds = messageIds.filter(id => 
      messages.find(m => m.id === id)?.read_at === null
    );
    if (unreadIds.length === 0) return;
    
    await dbWrite(
      supabase
        .from('game_opinion_replies')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)
        .neq('sender_id', user.id)
    );
  }, [user, messages]);

  // GAP-528: Sinalizar "digitando..."
  const sendTyping = useCallback(async () => {
    if (!user || !convId) return;
    try {
      await supabase
        .from('opinion_conversations')
        .update({ typing_users: [user.id] })
        .eq('id', convId);
    } catch { /* silencioso */ }
  }, [user, convId]);

  const stopTyping = useCallback(async () => {
    if (!user || !convId) return;
    try {
      const { data } = await supabase
        .from('opinion_conversations')
        .select('typing_users')
        .eq('id', convId)
        .maybeSingle();
      
      const current = (data as any)?.typing_users || [];
      const filtered = current.filter((id: string) => id !== user.id);
      
      await supabase
        .from('opinion_conversations')
        .update({ typing_users: filtered })
        .eq('id', convId);
    } catch { /* silencioso */ }
  }, [user, convId]);

  useEffect(() => {
    if (!user || !opinionId || !convId) return;
    (async () => {
      const [{ data: op }, { data: c }, { data: msgs }] = await Promise.all([
        supabase.from('game_opinions').select('*, author:profiles!user_id(display_name, avatar_url)').eq('id', opinionId).maybeSingle(),
        supabase.from('opinion_conversations').select('*').eq('id', convId).maybeSingle(),
        supabase.from('game_opinion_replies').select('*').eq('conversation_id', convId).order('created_at', { ascending: true }),
      ]);
      setOpinion(op);
      setConv(c);
      if (op?.product_id) {
        const { data: p } = await supabase.from('produtos').select('id,title,image_url').eq('id', op.product_id).maybeSingle();
        setProduct(p);
      }
      setMessages(msgs || []);
      setLoading(false);
      
      // Marcar mensagens como lidas
      if (msgs && msgs.length > 0) {
        const unreadIds = msgs
          .filter((m: any) => m.sender_id !== user.id && !m.read_at)
          .map((m: any) => m.id);
        if (unreadIds.length > 0) {
          markAsRead(unreadIds);
        }
      }
    })();

    // GAP-528: Escutar mudanças no campo typing_users
    const typingChannel = supabase
      .channel(`typing-${convId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'opinion_conversations',
          filter: `id=eq.${convId}`,
        },
        (payload) => {
          const typing = (payload.new as any)?.typing_users || [];
          setTypingUsers(typing.filter((id: string) => id !== user.id));
        }
      )
      .subscribe();

    // GAP-528: Escutar novas mensagens
    const ch = supabase.channel(`opconv-${convId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'game_opinion_replies', 
        filter: `conversation_id=eq.${convId}` 
      }, (p) => {
        const newMsg = p.new as any;
        setMessages(prev => [...prev, newMsg]);
        // Marcar como lida automaticamente
        if (newMsg.sender_id !== user.id) {
          markAsRead([newMsg.id]);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_opinion_replies',
        filter: `conversation_id=eq.${convId}`,
      }, (p) => {
        const updated = p.new as any;
        setMessages(prev => prev.map(m => 
          m.id === updated.id ? { ...m, ...updated } : m
        ));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'game_opinion_replies',
        filter: `conversation_id=eq.${convId}`,
      }, (p) => {
        const deleted = p.old as any;
        setMessages(prev => prev.filter(m => m.id !== deleted.id));
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(ch); 
      supabase.removeChannel(typingChannel);
      stopTyping();
    };
  }, [user, opinionId, convId, markAsRead]);

  useEffect(() => { 
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages]);

  // GAP-531: Editar mensagem
  const handleEdit = async (messageId: string, newText: string) => {
    if (!newText.trim()) {
      toast.error('A mensagem não pode ficar vazia');
      return;
    }
    const { error } = await supabase
      .from('game_opinion_replies')
      .update({ 
        text: newText.trim(),
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId);
    
    if (error) {
      toast.error('Erro ao editar mensagem');
      return;
    }
    setEditingId(null);
    toast.success('Mensagem editada');
  };

  // GAP-531: Excluir mensagem
  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase
      .from('game_opinion_replies')
      .delete()
      .eq('id', deletingId);
    
    if (error) {
      toast.error('Erro ao excluir mensagem');
      return;
    }
    setShowDeleteDialog(false);
    setDeletingId(null);
    toast.success('Mensagem excluída');
  };

  // GAP-530: Reagir a mensagem
  const handleReact = async (messageId: string, emoji: ReactionType) => {
    if (!user) return;
    
    // Verificar se já reagiu com este emoji
    const msg = messages.find(m => m.id === messageId);
    const reactions = msg?.reactions || {};
    const current = reactions[user.id] || null;
    
    let newReactions = { ...reactions };
    if (current === emoji) {
      // Remover reação
      delete newReactions[user.id];
    } else {
      // Adicionar/alterar reação
      newReactions[user.id] = emoji;
    }
    
    const { error } = await supabase
      .from('game_opinion_replies')
      .update({ reactions: newReactions })
      .eq('id', messageId);
    
    if (error) {
      toast.error('Erro ao reagir');
    }
  };

  // GAP-528: Enviar sinal de "digitando..."
  const handleTextChange = (value: string) => {
    setText(value);
    if (value.trim()) {
      sendTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(stopTyping, 2000);
    } else {
      stopTyping();
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    
    // Parar de digitar
    stopTyping();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    const { error } = await supabase.from('game_opinion_replies').insert({
      opinion_id: opinionId, conversation_id: convId,
      sender_id: user.id, responder_id: conv.responder_id, 
      text: text.trim(),
      reactions: {},
    });
    setSending(false);
    if (error) { toast.error('Erro ao enviar'); return; }
    setText('');
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!opinion || !conv) return <div className="container mx-auto py-20 text-center text-muted-foreground">Conversa não encontrada.</div>;

  const isParticipant = user.id === conv.author_id || user.id === conv.responder_id;
  if (!isParticipant) return (
    <div className="container mx-auto py-20 text-center">
      <Lock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
      <p className="text-muted-foreground">Esta conversa é privada.</p>
    </div>
  );

  // GAP-529: Agrupar mensagens por data para mostrar "visto"
  const getReadStatus = (message: any): 'sent' | 'delivered' | 'read' => {
    if (message.sender_id !== user.id) return 'sent';
    if (message.read_at) return 'read';
    return 'delivered';
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <Link to="/conversas-opinioes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> Conversas de Opiniões
      </Link>

      {/* Opinião fixa no topo */}
      <div className="bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/30 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-wider font-bold text-primary">Opinião original</span>
          {product && (
            <Link to={`/jogo/${product.id}`} className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
              <Gamepad2 className="h-3 w-3" /> {product.title}
            </Link>
          )}
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden shrink-0">
            {opinion.author?.avatar_url
              ? <img src={opinion.author.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              : <div className="w-full h-full flex items-center justify-center text-sm">{(opinion.author?.display_name || '?')[0]}</div>}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{opinion.author?.display_name || 'Autor'}</p>
            <p className="text-sm mt-1 whitespace-pre-wrap">{opinion.text}</p>
          </div>
        </div>
        {product && (
          <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
            <Link to={`/jogo/${product.id}/review-completa`} className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30">
              <BookOpen className="h-3 w-3" /> Escrever Review Completa
            </Link>
          </div>
        )}
      </div>

      {/* GAP-528: Indicador de "digitando..." */}
      {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}

      {/* Conversa */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3 min-h-[40vh] max-h-[60vh] overflow-y-auto">
        {messages.length === 0 ? (
          <EstadoVazio icone={MessageCircle} titulo="Nenhuma mensagem ainda" descricao="Comece a conversa sobre esta opinião — as respostas aparecem aqui." />
        ) : messages.map((m, index) => {
          const mine = m.sender_id === user.id;
          const isFirstInGroup = index === 0 || messages[index - 1]?.sender_id !== m.sender_id;
          const readStatus = getReadStatus(m);
          const canEdit = mine && !m.edited_at && 
            (new Date().getTime() - new Date(m.created_at).getTime()) < 5 * 60 * 1000; // 5 min
          const reactions = m.reactions || {};
          const userReaction = reactions[user.id] || null;
          const reactionCounts: Record<string, number> = {};
          Object.values(reactions).forEach((emoji: any) => {
            reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
          });

          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${!mine ? 'flex items-end gap-1.5' : ''}`}>
                {!mine && isFirstInGroup && (
                  <div className="w-6 h-6 rounded-full bg-secondary overflow-hidden shrink-0">
                    {opinion.author?.avatar_url
                      ? <img src={opinion.author.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center text-[8px]">{(opinion.author?.display_name || '?')[0]}</div>}
                  </div>
                )}
                <div className={`space-y-0.5 ${!mine ? 'ml-1.5' : ''}`}>
                  <div className={`rounded-lg px-3 py-2 text-sm ${mine ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    {m.edited_at && (
                      <span className="text-[9px] opacity-60 ml-1">(editado)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{formatDateTime(m.created_at)}</span>
                    {/* GAP-529: Status de leitura */}
                    {mine && (
                      <span className="ml-1" title={
                        readStatus === 'read' ? 'Visto' : 
                        readStatus === 'delivered' ? 'Entregue' : 'Enviado'
                      }>
                        {readStatus === 'read' ? '✓✓' : readStatus === 'delivered' ? '✓' : ''}
                      </span>
                    )}
                  </div>
                  {/* GAP-530: Reações */}
                  {Object.keys(reactionCounts).length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <span key={emoji} className="text-xs bg-card border border-border rounded-full px-1.5 py-0.5">
                          {emoji} {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {mine && (
                  <div className="flex items-center gap-0.5 ml-1">
                    {/* GAP-530: Botão de reação */}
                    <ReactionPicker 
                      onReact={(emoji) => handleReact(m.id, emoji)} 
                      currentReaction={userReaction as ReactionType | null}
                    />
                    {/* GAP-531: Menu de ações (editar/excluir) */}
                    {(canEdit || mine) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-0.5 rounded hover:bg-secondary transition-colors">
                            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && (
                            <DropdownMenuItem onClick={() => {
                              setEditingId(m.id);
                              setEditText(m.text);
                            }}>
                              <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => {
                              setDeletingId(m.id);
                              setShowDeleteDialog(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* GAP-531: Editor inline para edição */}
      {editingId && (
        <div className="mt-3 p-3 bg-secondary/30 border border-border rounded-lg">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Editando mensagem</span>
            <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <div className="flex gap-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className="flex-1 text-sm"
            />
            <Button 
              onClick={() => handleEdit(editingId, editText)}
              size="sm"
            >
              Salvar
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Textarea 
          value={text} 
          onChange={(e) => handleTextChange(e.target.value)} 
          placeholder="Sua mensagem..." 
          rows={2} 
          className="flex-1" 
        />
        <Button onClick={send} disabled={sending || !text.trim()} size="icon">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {/* GAP-531: Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A mensagem será removida permanentemente da conversa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}