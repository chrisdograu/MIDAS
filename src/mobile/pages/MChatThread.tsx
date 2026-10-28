import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Send, Image as ImageIcon, ArrowLeftRight, Loader2, Check, X, User, Sparkles, MoreVertical, Star, Archive, BellOff, ShieldOff, Flag, Package, Search, Eye, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { stripImageExif } from '@/lib/stripImageExif';
import { MobileBadge } from '@/mobile/lib/badge';
import { ItemActionsMenu } from '@/components/ItemActionsMenu';
import { GifPicker } from '@/components/GifPicker';
import { MentionText } from '@/mobile/components/MentionText';
import { recordMentions } from '@/mobile/lib/mentions';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency, formatTime } from '@/lib/format';
import { toggleMessageReaction } from '@/lib/toggleLike';

interface Msg {
  id: string; sender_id: string; receiver_id: string; content: string;
  created_at: string; is_read: boolean; message_type: string;
  payload: any | null; image_url: string | null; reply_to_id: string | null;
  edited_at?: string | null;
}
interface Reaction { id: string; message_id: string; user_id: string; emoji: string }
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎮'];
interface Conv { id: string; participant_1: string; participant_2: string; anuncio_id: string | null; match_id?: string | null; admin_visible?: boolean }
interface Other { id: string; display_name: string | null; avatar_url: string | null }
interface AdInfo { id: string; title: string; price: number; ad_type: string; accepts_counteroffer: boolean; desired_item: string | null }

// GAP-1022: Componente de busca dentro da conversa
function SearchInChat({ onSearch, onClose }: { onSearch: (query: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  return (
    <div className="flex items-center gap-2 p-2 bg-card border-b border-border">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSearch(e.target.value);
        }}
        placeholder="Buscar nesta conversa..."
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        autoFocus
      />
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function MChatThread() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conv, setConv] = useState<Conv | null>(null);
  const [other, setOther] = useState<Other | null>(null);
  const [ad, setAd] = useState<AdInfo | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [filteredMsgs, setFilteredMsgs] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerType, setOfferType] = useState<'money' | 'item'>('money');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerDesc, setOfferDesc] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [gifOpen, setGifOpen] = useState(false);
  
  // GAP-1021: Edição de mensagem
  const [editingMsg, setEditingMsg] = useState<Msg | null>(null);
  const [editText, setEditText] = useState('');
  
  // GAP-1022: Busca
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // GAP-1020: Notificação de nova mensagem
  const [newMsgCount, setNewMsgCount] = useState(0);

  // GAP-1019: Status de leitura
  const getReadStatus = (msg: Msg): 'sent' | 'delivered' | 'read' => {
    if (msg.sender_id !== user?.id) return 'sent';
    if (msg.is_read) return 'read';
    return 'delivered';
  };

  const load = async () => {
    if (!conversationId || !user) {
      setLoading(false);
      return;
    }
    const { data: c } = await supabase.from('conversas').select('id, participant_1, participant_2, anuncio_id, match_id, admin_visible').eq('id', conversationId).maybeSingle();
    if (!c) { setLoading(false); return; }
    const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
    const [{ data: p }, { data: a }, { data: m }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url').eq('id', otherId).maybeSingle(),
      c.anuncio_id ? supabase.from('anuncios').select('id, title, price, ad_type, accepts_counteroffer, desired_item').eq('id', c.anuncio_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('mensagens').select('id, sender_id, receiver_id, content, created_at, is_read, message_type, payload, image_url, reply_to_id, edited_at').or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`).order('created_at'),
    ]);
    setConv(c as Conv);
    setOther(p as Other);
    setAd(a as AdInfo | null);
    setMsgs((m || []) as Msg[]);
    setFilteredMsgs((m || []) as Msg[]);
    const ids = (m || []).map((x: any) => x.id);
    if (ids.length) {
      const { data: rx } = await supabase.from('message_reactions').select('id, message_id, user_id, emoji').in('message_id', ids);
      setReactions((rx || []) as Reaction[]);
    }
    setLoading(false);
    await supabase.from('mensagens').update({ is_read: true }).eq('receiver_id', user.id).eq('sender_id', otherId).eq('is_read', false);
  };

  const upsertMessage = (message: Msg) => {
    setMsgs((current) => {
      const next = [...current];
      const index = next.findIndex((item) => item.id === message.id);
      if (index >= 0) next[index] = message;
      else next.push(message);
      next.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      return next;
    });
    // GAP-1020: Notificação para novas mensagens de outros
    if (message.sender_id !== user?.id) {
      setNewMsgCount(prev => prev + 1);
      toast.info(`📩 Nova mensagem de ${other?.display_name || 'alguém'}`, {
        duration: 5000,
        action: {
          label: 'Ver',
          onClick: () => endRef.current?.scrollIntoView({ behavior: 'smooth' }),
        }
      });
    }
  };

  useEffect(() => {
    load();
    if (!conversationId || !user) return;
    const participantIds = conv ? [conv.participant_1, conv.participant_2].sort() : null;
    if (!participantIds) return;
    const ch = supabase.channel(`thread-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, (payload) => {
        const message = payload.new as Msg;
        const messageParticipants = [message.sender_id, message.receiver_id].sort();
        if (participantIds[0] !== messageParticipants[0] || participantIds[1] !== messageParticipants[1]) return;
        upsertMessage(message);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensagens' }, (payload) => {
        const message = payload.new as Msg;
        const messageParticipants = [message.sender_id, message.receiver_id].sort();
        if (participantIds[0] !== messageParticipants[0] || participantIds[1] !== messageParticipants[1]) return;
        upsertMessage(message);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload: any) => {
        const row = (payload.new || payload.old) as Reaction;
        if (!row?.message_id) return;
        setReactions(prev => {
          const filtered = prev.filter(r => r.id !== row.id);
          return payload.eventType === 'DELETE' ? filtered : [...filtered, payload.new as Reaction];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, user, conv?.participant_1, conv?.participant_2]);

  useEffect(() => { 
    if (!showSearch) {
      setFilteredMsgs(msgs);
    } else if (searchQuery) {
      setFilteredMsgs(msgs.filter(m => 
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.sender_id !== user?.id && other?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()))
      ));
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [msgs, searchQuery, showSearch]);

  // GAP-1021: Editar mensagem
  const handleEdit = async () => {
    if (!editingMsg || !editText.trim()) return;
    if (editText.trim() === editingMsg.content) {
      setEditingMsg(null);
      return;
    }
    const { error } = await supabase
      .from('mensagens')
      .update({ 
        content: editText.trim(),
        edited_at: new Date().toISOString(),
      })
      .eq('id', editingMsg.id);
    if (error) {
      toast.error('Erro ao editar mensagem');
      return;
    }
    setMsgs(prev => prev.map(m => 
      m.id === editingMsg.id 
        ? { ...m, content: editText.trim(), edited_at: new Date().toISOString() }
        : m
    ));
    setEditingMsg(null);
    toast.success('Mensagem editada');
  };

  const sendText = async () => {
    if (!text.trim() || !user || !other || sending) return;
    setSending(true);
    const content = text.trim().slice(0, 1000);
    setText('');
    const last = msgs[msgs.length - 1];
    if (last && last.sender_id === user.id && last.content === content && Date.now() - +new Date(last.created_at) < 3000) {
      setSending(false);
      toast.info('Mensagem duplicada ignorada');
      return;
    }
    const { data: inserted, error } = await supabase.from('mensagens').insert({
      sender_id: user.id, receiver_id: other.id, content,
      anuncio_id: conv?.anuncio_id || null, message_type: 'text',
      reply_to_id: replyTo?.id || null,
    } as any).select('id, sender_id, receiver_id, content, created_at, is_read, message_type, payload, image_url, reply_to_id, edited_at').single();
    if (error) toast.error('Erro ao enviar');
    else if (inserted) {
      upsertMessage(inserted as Msg);
      if (conv) await supabase.from('conversas').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', conv.id);
    }
    setReplyTo(null);
    setSending(false);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const res = await toggleMessageReaction(messageId, emoji);
    if (!res) { toast.error('Não foi possível reagir'); return; }
    const { data } = await supabase.from('message_reactions')
      .select('id, message_id, user_id, emoji').eq('message_id', messageId);
    setReactions(prev => [
      ...prev.filter(r => r.message_id !== messageId),
      ...((data ?? []) as Reaction[]),
    ]);
    setReactionTarget(null);
  };

  const sendImage = async (raw: File) => {
    if (!user || !other) return;
    if (raw.size > 5 * 1024 * 1024) { toast.error('Imagem deve ter no máximo 5MB'); return; }
    setSending(true);
    const file = await stripImageExif(raw);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
    const { error: upErr } = await supabase.storage.from('chat-images').upload(path, file);
    if (upErr) { toast.error('Erro ao enviar imagem'); setSending(false); return; }
    const { data: pub } = supabase.storage.from('chat-images').getPublicUrl(path);
    const { error } = await supabase.from('mensagens').insert({
      sender_id: user.id, receiver_id: other.id, content: '[imagem]', image_url: pub.publicUrl,
      anuncio_id: conv?.anuncio_id || null, message_type: 'image',
    });
    if (error) { toast.error(`Erro ao enviar imagem: ${error.message}`); setSending(false); return; }
    if (conv) await supabase.from('conversas').update({ last_message: '📷 Imagem', last_message_at: new Date().toISOString() }).eq('id', conv.id);
    setSending(false);
  };

  const sendGif = async (url: string) => {
    if (!user || !other) return;
    setGifOpen(false);
    setSending(true);
    const { error } = await supabase.from('mensagens').insert({
      sender_id: user.id, receiver_id: other.id, content: '[gif]', image_url: url,
      anuncio_id: conv?.anuncio_id || null, message_type: 'image',
    });
    if (error) { toast.error(`Erro ao enviar GIF: ${error.message}`); setSending(false); return; }
    if (conv) await supabase.from('conversas').update({ last_message: '🎞️ GIF', last_message_at: new Date().toISOString() }).eq('id', conv.id);
    setSending(false);
  };

  const sendOffer = async () => {
    if (!user || !other) return;
    const payload = offerType === 'money'
      ? { type: 'money', amount: Number(offerAmount), status: 'pending' }
      : { type: 'item', desc: offerDesc.trim().slice(0, 200), status: 'pending' };
    if (offerType === 'money' && (!offerAmount || isNaN(Number(offerAmount)))) { toast.error('Valor inválido'); return; }
    if (offerType === 'item' && !offerDesc.trim()) { toast.error('Descreva o item'); return; }
    setSending(true);
    const { error } = await supabase.from('mensagens').insert({
      sender_id: user.id, receiver_id: other.id,
      content: offerType === 'money' ? `Contraoferta: R$ ${offerAmount}` : `Contraoferta de troca: ${offerDesc}`,
      anuncio_id: conv?.anuncio_id || null, message_type: 'counteroffer', payload,
    });
    if (error) { toast.error(`Erro ao enviar contraoferta: ${error.message}`); setSending(false); return; }
    if (conv) await supabase.from('conversas').update({ last_message: '💱 Contraoferta', last_message_at: new Date().toISOString() }).eq('id', conv.id);
    setOfferOpen(false); setOfferAmount(''); setOfferDesc(''); setSending(false);
    toast.success('Contraoferta enviada');
  };

  const respondOffer = async (msg: Msg, accepted: boolean) => {
    if (!user) return;
    const newPayload = { ...msg.payload, status: accepted ? 'accepted' : 'rejected' };
    await supabase.from('mensagens').update({ payload: newPayload }).eq('id', msg.id);
    await supabase.from('mensagens').insert({
      sender_id: user.id, receiver_id: msg.sender_id,
      content: accepted ? '✅ Contraoferta aceita' : '❌ Contraoferta recusada',
      anuncio_id: conv?.anuncio_id || null, message_type: 'text',
    });
  };

  const deleteMessage = async (m: Msg) => {
    if (!user || m.sender_id !== user.id) return;
    const { error } = await supabase.from('mensagens').delete().eq('id', m.id);
    if (error) { toast.error('Não foi possível excluir'); return; }
    setMsgs(prev => prev.filter(x => x.id !== m.id));
    toast.success('Mensagem excluída');
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!conv) return <div className="p-6 text-center text-muted-foreground">Conversa não encontrada.</div>;

  const canCounteroffer = ad && (ad.accepts_counteroffer || ad.ad_type === 'troca');
  const threadHeight = 'calc(100dvh - 57px - 68px - env(safe-area-inset-bottom))';

  return (
    <div className="flex flex-col overflow-hidden bg-background" style={{ minHeight: threadHeight, height: threadHeight }}>
      <header className="z-20 backdrop-blur-xl bg-background/80 border-b border-border/50 px-3 py-2 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/m/chat')} className="p-1"><ArrowLeft className="h-5 w-5" /></button>
        <Link to={`/m/chat/${conversationId}/info`} className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            {other?.avatar_url ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : other?.display_name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{other?.display_name || 'Usuário'}</p>
            {ad && <p className="text-[10px] text-muted-foreground truncate">📦 {ad.title}</p>}
          </div>
        </Link>
        {/* GAP-1022: Botão de busca */}
        <button onClick={() => setShowSearch(!showSearch)} className="p-2 text-muted-foreground hover:text-foreground">
          <Search className="h-4 w-4" />
        </button>
        {ad && (
          <Link to={`/m/marketplace/${ad.id}`} className="p-2 rounded-lg bg-primary/15 text-primary text-[10px] font-semibold flex items-center gap-1" title="Ver produto">
            <Package className="h-3.5 w-3.5" /> Produto
          </Link>
        )}
        <Link to={`/m/chat/${conversationId}/info`} className="p-2"><MoreVertical className="h-4 w-4 text-muted-foreground" /></Link>
      </header>

      {/* GAP-1022: Barra de busca */}
      {showSearch && (
        <SearchInChat 
          onSearch={(q) => setSearchQuery(q)} 
          onClose={() => { setShowSearch(false); setSearchQuery(''); }} 
        />
      )}

      {conv?.match_id && conv?.admin_visible && (
        <div className="px-3 py-2 bg-warning/10 border-b border-warning/30 text-[11px] text-warning font-medium text-center">
          🛡️ Conversa de partida — pode ser lida pela moderação em caso de disputa.
        </div>
      )}

      <div className="flex-1 min-h-0 px-3 py-3 space-y-2 overflow-y-auto">
        {filteredMsgs.length === 0 && (
          <EstadoVazio icone={Send} titulo="Nenhuma mensagem encontrada" descricao={searchQuery ? 'Nada corresponde à sua busca.' : 'Mande a primeira mensagem para começar a conversa.'} />
        )}
        {filteredMsgs.map(m => {
          const own = m.sender_id === user?.id;
          const readStatus = getReadStatus(m);
          const canEdit = own && !m.edited_at && (Date.now() - new Date(m.created_at).getTime()) < 5 * 60 * 1000;
          
          if (m.message_type === 'counteroffer') {
            const status = m.payload?.status || 'pending';
            return (
              <div key={m.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] glass border border-accent/40 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-accent text-xs font-bold uppercase tracking-wide">
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Contraoferta
                  </div>
                  <p className="text-sm font-semibold">
                    {m.payload?.type === 'money' ? `💰 ${formatCurrency(Number(m.payload.amount))}` : `🎮 ${m.payload?.desc}`}
                  </p>
                  {status === 'pending' && !own && (
                    <div className="flex gap-2">
                      <button onClick={() => respondOffer(m, true)} className="flex-1 py-1.5 rounded-lg bg-success/20 text-success text-xs font-semibold flex items-center justify-center gap-1"><Check className="h-3 w-3" />Aceitar</button>
                      <button onClick={() => respondOffer(m, false)} className="flex-1 py-1.5 rounded-lg bg-destructive/20 text-destructive text-xs font-semibold flex items-center justify-center gap-1"><X className="h-3 w-3" />Recusar</button>
                    </div>
                  )}
                  {status !== 'pending' && (
                    <MobileBadge tone={status === 'accepted' ? 'success' : 'muted'}>
                      {status === 'accepted' ? '✅ Aceita' : '❌ Recusada'}
                    </MobileBadge>
                  )}
                </div>
              </div>
            );
          }
          const replied = m.reply_to_id ? msgs.find(x => x.id === m.reply_to_id) : null;
          const msgReactions = reactions.filter(r => r.message_id === m.id);
          const agg = msgReactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
            const e = acc[r.emoji] || { count: 0, mine: false };
            e.count += 1;
            if (r.user_id === user?.id) e.mine = true;
            acc[r.emoji] = e;
            return acc;
          }, {});
          return (
            <div key={m.id} className={`group flex items-end gap-1 ${own ? 'justify-end' : 'justify-start'}`}>
              {own && (
                <ItemActionsMenu
                  copyText={m.image_url ? undefined : m.content}
                  canEdit={false}
                  canDelete
                  onDelete={() => deleteMessage(m)}
                  deleteConfirm="Excluir esta mensagem?"
                  iconClassName="h-3.5 w-3.5"
                />
              )}
              <div className="flex flex-col items-stretch max-w-[78%] gap-1">
                <div className={`rounded-2xl px-3 py-2 ${own ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card text-foreground rounded-bl-sm border border-border/50'}`}>
                  {replied && (
                    <a href={`#msg-${replied.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`msg-${replied.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                      className={`block mb-1 px-2 py-1 rounded text-[11px] border-l-2 ${own ? 'border-primary-foreground/60 bg-primary-foreground/10' : 'border-primary bg-primary/10'} line-clamp-2 opacity-90`}>
                      <span className="font-semibold">{replied.sender_id === user?.id ? 'Você' : (other?.display_name || 'Usuário')}</span>: {replied.image_url ? '📷 imagem' : replied.content.slice(0, 80)}
                    </a>
                  )}
                  <span id={`msg-${m.id}`} />
                  {m.image_url
                    ? <img src={m.image_url} alt="" className="rounded-lg max-h-60 object-cover" loading="lazy" />
                    : <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>}
                  {m.edited_at && <span className="text-[9px] opacity-60 ml-1">(editado)</span>}
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-[9px] ${own ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{formatTime(m.created_at)}</p>
                    <div className="flex items-center gap-1">
                      {/* GAP-1019: Status de leitura */}
                      {own && (
                        <span className={`text-[9px] ${readStatus === 'read' ? 'text-primary-foreground/80' : 'text-primary-foreground/40'}`}>
                          {readStatus === 'read' ? '✓✓' : readStatus === 'delivered' ? '✓' : ''}
                        </span>
                      )}
                      {/* GAP-1021: Editar mensagem */}
                      {canEdit && (
                        <button 
                          onClick={() => { setEditingMsg(m); setEditText(m.content); }}
                          className={`text-[10px] opacity-60 hover:opacity-100 ${own ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                          title="Editar"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => setReplyTo(m)} title="Responder"
                        className={`text-[10px] opacity-60 hover:opacity-100 ${own ? 'text-primary-foreground' : 'text-muted-foreground'}`}>↩</button>
                      <button onClick={() => setReactionTarget(reactionTarget === m.id ? null : m.id)} title="Reagir"
                        className={`text-[11px] opacity-60 hover:opacity-100 ${own ? 'text-primary-foreground' : 'text-muted-foreground'}`}>☺</button>
                    </div>
                  </div>
                </div>
                {Object.keys(agg).length > 0 && (
                  <div className={`flex flex-wrap gap-1 ${own ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(agg).map(([emoji, info]) => (
                      <button key={emoji} onClick={() => toggleReaction(m.id, emoji)}
                        className={`text-[11px] rounded-full px-1.5 py-0.5 border ${info.mine ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-card border-border text-muted-foreground'}`}>
                        {emoji} {info.count}
                      </button>
                    ))}
                  </div>
                )}
                {reactionTarget === m.id && (
                  <div className={`flex gap-1 bg-card border border-border rounded-full px-2 py-1 shadow ${own ? 'self-end' : 'self-start'}`}>
                    {REACTION_EMOJIS.map(e => (
                      <button key={e} onClick={() => toggleReaction(m.id, e)} className="text-base hover:scale-125 transition-transform">{e}</button>
                    ))}
                  </div>
                )}
              </div>
              {!own && (
                <ItemActionsMenu
                  copyText={m.image_url ? undefined : m.content}
                  reportType="mensagem"
                  reportTargetId={m.id}
                  reportLabel="mensagem"
                  iconClassName="h-3.5 w-3.5"
                />
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* GAP-1021: Editor de edição inline */}
      {editingMsg && (
        <div className="shrink-0 p-2 bg-card border-t border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Editando mensagem</span>
            <button onClick={() => setEditingMsg(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
          <div className="flex gap-2">
            <input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
            />
            <button onClick={handleEdit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Salvar</button>
          </div>
        </div>
      )}

      <div className="shrink-0 backdrop-blur-xl bg-background/90 border-t border-border/50 px-2 py-2">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/10 border-l-2 border-primary text-xs">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-primary">Respondendo a {replyTo.sender_id === user?.id ? 'você' : (other?.display_name || 'Usuário')}</p>
              <p className="text-muted-foreground truncate">{replyTo.image_url ? '📷 imagem' : replyTo.content.slice(0, 80)}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {canCounteroffer && (
          <button onClick={() => setOfferOpen(true)} className="w-full mb-2 py-1.5 rounded-lg bg-accent/20 text-accent text-xs font-semibold flex items-center justify-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5" /> Fazer contraoferta
          </button>
        )}
        <div className="flex items-center gap-1.5">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && sendImage(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={sending} className="p-2.5 rounded-full bg-secondary text-muted-foreground"><ImageIcon className="h-4 w-4" /></button>
          {!ad && (
            <button onClick={() => setGifOpen(true)} disabled={sending} className="p-2.5 rounded-full bg-secondary text-accent" title="Enviar GIF"><Sparkles className="h-4 w-4" /></button>
          )}
          <input
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendText())}
            placeholder="Digite uma mensagem..." maxLength={1000}
            className="flex-1 px-3 py-2.5 bg-card border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button onClick={sendText} aria-label="Enviar mensagem" disabled={sending || !text.trim()} className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground flex items-center justify-center disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {offerOpen && (
        <div className="fixed inset-0 z-50 overlay-scrim flex items-end" onClick={() => setOfferOpen(false)}>
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} className="w-full bg-card rounded-t-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-accent" />Fazer contraoferta</h3>
            <div className="flex gap-2 p-1 bg-secondary rounded-lg">
              <button onClick={() => setOfferType('money')} className={`flex-1 py-2 rounded-md text-xs font-semibold ${offerType === 'money' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>💰 Dinheiro</button>
              <button onClick={() => setOfferType('item')} className={`flex-1 py-2 rounded-md text-xs font-semibold ${offerType === 'item' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>🎮 Item</button>
            </div>
            {offerType === 'money' ? (
              <input type="number" step="0.01" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} placeholder="R$ 0,00" className="w-full p-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            ) : (
              <textarea value={offerDesc} onChange={e => setOfferDesc(e.target.value)} maxLength={200} rows={3} placeholder="Descreva o item que está oferecendo..." className="w-full p-3 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
            )}
            <div className="flex gap-2">
              <button onClick={() => setOfferOpen(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold">Cancelar</button>
              <button onClick={sendOffer} disabled={sending} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold">Enviar</button>
            </div>
          </motion.div>
        </div>
      )}

      {gifOpen && <GifPicker onSelect={sendGif} onClose={() => setGifOpen(false)} />}
    </div>
  );
}