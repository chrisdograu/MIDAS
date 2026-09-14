import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Image as ImageIcon, FileText, Sparkles, ShieldAlert, ShieldOff, BellOff, Bell, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import EstadoVazio from '@/components/EstadoVazio';
import { dbWrite } from '@/lib/dbWrite';
import { motion, AnimatePresence } from 'framer-motion';

interface Msg { id: string; content: string; image_url: string | null; message_type: string; created_at: string; }

// GAP-1015: Lightbox para imagens
function ImageLightbox({ images, initialIndex, onClose }: { images: string[]; initialIndex: number; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  if (images.length === 0) return null;
  
  const currentImage = images[currentIndex];
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-10"
      >
        <X className="h-8 w-8" />
      </button>
      
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((currentIndex - 1 + images.length) % images.length); }}
            className="absolute left-4 text-white/70 hover:text-white p-2 z-10"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((currentIndex + 1) % images.length); }}
            className="absolute right-4 text-white/70 hover:text-white p-2 z-10"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </>
      )}
      
      <img
        src={currentImage}
        alt="Imagem expandida"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
        loading="lazy"
      />
    </motion.div>
  );
}

export default function MChatInfo() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conv, setConv] = useState<any>(null);
  const [other, setOther] = useState<any>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [tab, setTab] = useState<'images'|'gifs'|'files'>('images');
  
  // GAP-1015: Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!user || !conversationId) return;
    (async () => {
      const { data: c } = await supabase.from('conversas').select('*').eq('id', conversationId).maybeSingle();
      if (!c) { setLoading(false); return; }
      setConv(c);
      const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
      const [{ data: p }, { data: ms }, { data: b }, { data: cs }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, bio').eq('id', otherId).maybeSingle(),
        supabase.from('mensagens').select('id, content, image_url, message_type, created_at')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: false }).limit(300),
        supabase.from('blocked_users').select('id').eq('blocker_id', user.id).eq('blocked_id', otherId).maybeSingle(),
        supabase.from('conversation_settings').select('muted').eq('conversation_id', conversationId).eq('user_id', user.id).maybeSingle(),
      ]);
      setOther(p);
      setMsgs((ms || []) as any);
      setBlocked(!!b);
      setMuted(!!cs?.muted);
      setLoading(false);
    })();
  }, [user?.id, conversationId]);

  if (!user) return <Navigate to="/m/auth" replace />;
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!conv || !other) return <div className="p-6 text-center text-muted-foreground">Conversa não encontrada</div>;

  const images = msgs.filter(m => m.image_url && m.content === '[imagem]');
  const gifs = msgs.filter(m => m.image_url && m.content === '[gif]');
  const files = msgs.filter(m => m.message_type === 'file');
  
  const imageUrls = images.map(m => m.image_url!);
  const gifUrls = gifs.map(m => m.image_url!);

  const block = async () => {
    if (blocked) {
      const ok = await dbWrite(
        supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', other.id),
        'Não foi possível desbloquear o usuário',
      );
      if (!ok) return;
      toast.success('Desbloqueado'); setBlocked(false);
    } else {
      if (!confirm(`Bloquear ${other.display_name}?`)) return;
      const ok = await dbWrite(
        supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: other.id } as any),
        'Não foi possível bloquear o usuário',
      );
      if (!ok) return;
      toast.success('Bloqueado'); setBlocked(true);
    }
  };

  const toggleMute = async () => {
    const next = !muted;
    if (!conversationId) return;
    const ok = await dbWrite(
      supabase.from('conversation_settings').upsert({
        conversation_id: conversationId, user_id: user.id, muted: next,
      } as any, { onConflict: 'conversation_id,user_id' }),
      'Não foi possível alterar as notificações',
    );
    if (!ok) return;
    setMuted(next);
    toast.success(next ? '🔕 Notificações silenciadas' : '🔔 Notificações ativas');
  };

  const openLightbox = (urls: string[], index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <div className="px-4 py-5 space-y-4 pb-24">
      <Link to={`/m/chat/${conversationId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar à conversa</Link>

      <Link to={`/m/perfil/${other.id}`} className="block text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground text-2xl font-bold">
          {other.avatar_url ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : other.display_name?.[0]?.toUpperCase()}
        </div>
        <h1 className="font-display text-lg font-bold mt-2">{other.display_name}</h1>
        {other.bio && <p className="text-xs text-muted-foreground mt-1">{other.bio}</p>}
        <p className="text-[10px] text-primary mt-1">Toque para abrir perfil</p>
      </Link>

      {/* Galeria com lightbox */}
      <section className="glass rounded-xl p-3">
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg mb-3">
          <button onClick={() => setTab('images')} className={`flex-1 py-1.5 rounded-md text-xs font-semibold ${tab === 'images' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><ImageIcon className="h-3 w-3 inline mr-1" />Imagens ({images.length})</button>
          <button onClick={() => setTab('gifs')} className={`flex-1 py-1.5 rounded-md text-xs font-semibold ${tab === 'gifs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><Sparkles className="h-3 w-3 inline mr-1" />GIFs ({gifs.length})</button>
          <button onClick={() => setTab('files')} className={`flex-1 py-1.5 rounded-md text-xs font-semibold ${tab === 'files' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><FileText className="h-3 w-3 inline mr-1" />Arquivos ({files.length})</button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(tab === 'images' ? images : tab === 'gifs' ? gifs : []).map((m, index) => (
            <button
              key={m.id}
              onClick={() => openLightbox(tab === 'images' ? imageUrls : gifUrls, index)}
              className="aspect-square rounded-lg overflow-hidden bg-secondary hover:opacity-80 transition-opacity"
            >
              <img src={m.image_url!} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
          {tab === 'files' && files.map(m => (
            <div key={m.id} className="col-span-3 p-2 bg-secondary rounded-lg text-xs flex items-center gap-2"><FileText className="h-3 w-3" />{m.content}</div>
          ))}
        </div>
        {((tab === 'images' && !images.length) || (tab === 'gifs' && !gifs.length) || (tab === 'files' && !files.length)) && (
          <EstadoVazio
            icone={tab === 'files' ? FileText : ImageIcon}
            titulo="Nada por aqui ainda"
            descricao={tab === 'images' ? 'As imagens enviadas na conversa aparecerão aqui.' : tab === 'gifs' ? 'Os GIFs enviados na conversa aparecerão aqui.' : 'Os arquivos enviados na conversa aparecerão aqui.'}
          />
        )}
      </section>

      <section className="space-y-2">
        <button onClick={toggleMute} className="w-full p-3 rounded-xl bg-card border border-border text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            {muted ? <BellOff className="h-4 w-4 text-muted-foreground" /> : <Bell className="h-4 w-4 text-primary" />}
            Silenciar notificações
          </span>
          <span className={`relative w-10 h-5 rounded-full transition-colors ${muted ? 'bg-primary' : 'bg-secondary'}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background transition-transform ${muted ? 'translate-x-5' : ''}`} />
          </span>
        </button>
        <button onClick={block} className="w-full p-3 rounded-xl bg-card border border-border text-sm font-semibold flex items-center justify-center gap-2 text-destructive">
          <ShieldOff className="h-4 w-4" /> {blocked ? 'Desbloquear usuário' : 'Bloquear usuário'}
        </button>
        <Link to={`/m/perfil/${other.id}`} className="w-full p-3 rounded-xl bg-card border border-border text-sm font-semibold flex items-center justify-center gap-2 text-destructive">
          <ShieldAlert className="h-4 w-4" /> Denunciar (via perfil)
        </Link>
      </section>

      {/* GAP-1015: Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <ImageLightbox
            images={tab === 'images' ? imageUrls : gifUrls}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}