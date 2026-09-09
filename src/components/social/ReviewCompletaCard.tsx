import { Link } from 'react-router-dom';
import { BookOpen, Clock, Gamepad2, Heart, Lock, ShieldCheck, ThumbsDown, ThumbsUp, Users, Star, Edit, Eye, MessageSquare, Image, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import SpoilerGuard from '@/components/spoiler/SpoilerGuard';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ReviewCompletaData {
  id: string;
  user_id: string;
  product_id: string;
  analise: string;
  horas_jogadas: number | null;
  plataforma: string | null;
  dificuldade: string | null;
  status: string | null;
  recomendacao: string | null;
  personagens_favoritos: string | null;
  trilha_sonora_favorita: string | null;
  momentos_favoritos: string | null;
  pros: string[] | null;
  contras: string[] | null;
  tags_emocionais: string[] | null;
  visibility: 'friends' | 'private';
  created_at: string;
  updated_at?: string | null;
  is_spoiler?: boolean | null;
  spoiler_achievement_name?: string | null;
  verified_purchase?: boolean | null;
  rating?: number | null;
  images?: string[] | null;
  views_count?: number;
  profile?: { display_name?: string | null; avatar_url?: string | null } | null;
}

// ─── COMENTÁRIO ──────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  user_id: string;
  review_id: string;
  content: string;
  created_at: string;
  updated_at?: string | null;
  profile?: { display_name?: string | null; avatar_url?: string | null } | null;
}

// ─── COMPONENTE DE COMENTÁRIO ──────────────────────────────────────────────

function CommentItem({ comment, isOwn }: { comment: Comment; isOwn: boolean }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const loadReplies = useCallback(async () => {
    if (replies.length > 0) return;
    setLoadingReplies(true);
    const { data } = await supabase
      .from('review_comments')
      .select('*, profile:profiles!user_id(display_name, avatar_url)')
      .eq('parent_id', comment.id)
      .order('created_at', { ascending: true });
    setReplies((data as any) || []);
    setLoadingReplies(false);
  }, [comment.id, replies.length]);

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    const { error } = await supabase.from('review_comments').insert({
      review_id: comment.review_id,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      content: replyText.trim(),
      parent_id: comment.id,
    });
    setSendingReply(false);
    if (error) { toast.error('Erro ao enviar resposta'); return; }
    setReplyText('');
    setShowReply(false);
    loadReplies();
    toast.success('Resposta enviada!');
  };

  return (
    <div className="pl-4 border-l-2 border-border/60">
      <div className="flex items-start gap-2 py-2">
        <div className="w-7 h-7 rounded-full bg-secondary overflow-hidden shrink-0">
          {comment.profile?.avatar_url ? (
            <img src={comment.profile.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              {(comment.profile?.display_name || '?')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              {comment.profile?.display_name || 'Usuário'}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatRelativeTime(comment.created_at)}
            </span>
            {comment.updated_at && comment.updated_at !== comment.created_at && (
              <span className="text-[8px] text-muted-foreground/60">· editado</span>
            )}
          </div>
          <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
          <button
            onClick={() => setShowReply(!showReply)}
            className="text-[10px] text-muted-foreground hover:text-primary mt-1 transition"
          >
            Responder
          </button>
          {showReply && (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Escreva uma resposta..."
                className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={e => e.key === 'Enter' && sendReply()}
              />
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sendingReply}
                className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {loadingReplies ? (
            <div className="mt-2 text-[10px] text-muted-foreground">Carregando...</div>
          ) : replies.length > 0 && (
            <div className="mt-2 space-y-1">
              {replies.map(r => (
                <CommentItem key={r.id} comment={r} isOwn={isOwn} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function ReviewCompletaCard({ review }: { review: ReviewCompletaData }) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const pros = review.pros || [];
  const contras = review.contras || [];
  const tags = review.tags_emocionais || [];
  const images = review.images || [];
  const isOwn = user?.id === review.user_id;

  // ─── CARREGAR COMENTÁRIOS ─────────────────────────────────────────────────

  const loadComments = useCallback(async () => {
    if (!showComments) return;
    setLoadingComments(true);

    // Busca comentários raiz (sem parent_id)
    const { data } = await supabase
      .from('review_comments')
      .select('*, profile:profiles!user_id(display_name, avatar_url)')
      .eq('review_id', review.id)
      .is('parent_id', null)
      .order('created_at', { ascending: true });

    const rawComments = (data || []) as any[];

    // ─── REGRA DE VISIBILIDADE (GRAFO DE AMIZADES) ──────────────────────
    // Comentário visível SE:
    // 1. Usuário é amigo do autor do review OU é o autor
    // 2. Usuário é amigo do autor do comentário OU é o autor do comentário

    if (user) {
      // Buscar amigos do usuário atual
      const { data: friends } = await supabase
        .from('v_friendships')
        .select('friend_id')
        .eq('user_id', user.id);
      const friendIds = new Set((friends || []).map((f: any) => f.friend_id));
      friendIds.add(user.id); // Usuário vê os próprios comentários

      // Buscar amigos do autor da review
      const { data: authorFriends } = await supabase
        .from('v_friendships')
        .select('friend_id')
        .eq('user_id', review.user_id);
      const authorFriendIds = new Set((authorFriends || []).map((f: any) => f.friend_id));
      authorFriendIds.add(review.user_id);

      const filtered = rawComments.filter(c => {
        const isFriendOfAuthor = friendIds.has(review.user_id) || review.user_id === user.id;
        const isFriendOfCommenter = friendIds.has(c.user_id) || c.user_id === user.id;
        // Só mostra se o usuário é amigo do autor E amigo do comentarista
        return isFriendOfAuthor && isFriendOfCommenter;
      });

      setComments(filtered);
      setCommentCount(filtered.length);
    } else {
      // Usuário deslogado: não vê comentários
      setComments([]);
      setCommentCount(0);
    }

    setLoadingComments(false);
  }, [review.id, review.user_id, user, showComments]);

  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments, loadComments]);

  // ─── ENVIAR COMENTÁRIO ───────────────────────────────────────────────────

  const sendComment = async () => {
    if (!user || !commentText.trim()) return;

    // Verifica se o usuário é amigo do autor da review
    const { data: isFriend } = await supabase
      .from('v_friendships')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('friend_id', review.user_id)
      .maybeSingle();

    if (!isFriend && user.id !== review.user_id) {
      toast.error('Apenas amigos do autor podem comentar');
      return;
    }

    setSendingComment(true);
    const { error } = await supabase.from('review_comments').insert({
      review_id: review.id,
      user_id: user.id,
      content: commentText.trim(),
    });
    setSendingComment(false);

    if (error) {
      toast.error('Erro ao enviar comentário');
      return;
    }

    setCommentText('');
    toast.success('Comentário enviado!');
    loadComments();
  };

  // ─── GALERIA DE IMAGENS ──────────────────────────────────────────────────

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => setIsLightboxOpen(false);
  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <article className="bg-card border border-border rounded-xl p-5 space-y-3">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link to={`/amigo/${review.user_id}`} className="flex items-center gap-2 hover:opacity-80">
          {review.profile?.avatar_url ? (
            <img src={review.profile.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" loading="lazy" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
              {(review.profile?.display_name || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">{review.profile?.display_name || 'Amigo'}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <BookOpen className="h-3 w-3" /> Review Completa · {formatDate(review.created_at)}
              {/* GAP-RC02: Indicador de editado */}
              {review.updated_at && review.updated_at !== review.created_at && (
                <span className="text-[8px] text-muted-foreground/60 flex items-center gap-0.5">
                  <Edit className="h-2.5 w-2.5" /> editado
                </span>
              )}
            </p>
          </div>
        </Link>
        <span className="ml-auto flex items-center gap-1.5">
          {/* GAP-RC04: Rating/Nota */}
          {review.rating !== null && review.rating !== undefined && (
            <span className="text-[10px] flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
              <Star className="h-3 w-3 fill-current" /> {review.rating.toFixed(1)}
            </span>
          )}
          {/* GAP-RC05: Visualizações */}
          {review.views_count !== undefined && review.views_count > 0 && (
            <span className="text-[10px] flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              <Eye className="h-3 w-3" /> {review.views_count}
            </span>
          )}
          {review.verified_purchase && (
            <span className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30" title="Comprou o jogo aqui na MIDIAS">
              <ShieldCheck className="h-3 w-3" /> Compra verificada
            </span>
          )}
          <span className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-muted-foreground">
            {review.visibility === 'private' ? <><Lock className="h-3 w-3" /> Close</> : <><Users className="h-3 w-3" /> Amigos</>}
          </span>
        </span>
      </header>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {review.horas_jogadas != null && <Tag icon={Clock}>{review.horas_jogadas}h</Tag>}
        {review.plataforma && <Tag icon={Gamepad2}>{review.plataforma}</Tag>}
        {review.dificuldade && <Tag className="bg-warning/20 text-warning">{review.dificuldade}</Tag>}
        {review.status && <Tag className="bg-primary/20 text-primary">{review.status}</Tag>}
        {review.recomendacao && <Tag className="bg-accent/20 text-accent">{review.recomendacao}</Tag>}
        {tags.map(t => <Tag key={t} icon={Heart} className="bg-muted text-muted-foreground">{t}</Tag>)}
      </div>

      {/* Conteúdo com Spoiler Guard */}
      <SpoilerGuard
        isSpoiler={!!review.is_spoiler}
        achievementName={review.spoiler_achievement_name}
        productId={review.product_id}
      >
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{review.analise}</p>
      </SpoilerGuard>

      {/* GAP-RC03: Galeria de imagens */}
      {images.length > 0 && (
        <div className="mt-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {images.slice(0, 4).map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="w-24 h-24 rounded-lg object-cover cursor-pointer hover:opacity-90 transition flex-shrink-0"
                onClick={() => openLightbox(i)}
                loading="lazy"
              />
            ))}
            {images.length > 4 && (
              <div
                className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition flex-shrink-0"
                onClick={() => openLightbox(0)}
              >
                <span className="text-xs font-semibold text-muted-foreground">+{images.length - 4}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={closeLightbox}>
          <button onClick={closeLightbox} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10">
            <Image className="h-5 w-5" />
          </button>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-10">
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <img src={images[currentImageIndex]} alt="" className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <span className="absolute bottom-4 text-white/60 text-sm">{currentImageIndex + 1} / {images.length}</span>
        </div>
      )}

      {/* Prós e Contras */}
      {(pros.length > 0 || contras.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {pros.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-success flex items-center gap-1 mb-1"><ThumbsUp className="h-3 w-3" /> Prós</p>
              <ul className="space-y-1 text-xs text-foreground">
                {pros.map((p, i) => <li key={i}>• {p}</li>)}
              </ul>
            </div>
          )}
          {contras.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-destructive flex items-center gap-1 mb-1"><ThumbsDown className="h-3 w-3" /> Contras</p>
              <ul className="space-y-1 text-xs text-foreground">
                {contras.map((p, i) => <li key={i}>• {p}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Detalhes extras */}
      {(review.personagens_favoritos || review.trilha_sonora_favorita || review.momentos_favoritos) && (
        <div className="pt-2 space-y-1 border-t border-border">
          {review.personagens_favoritos && <Detail label="Personagens">{review.personagens_favoritos}</Detail>}
          {review.trilha_sonora_favorita && <Detail label="Trilha sonora">{review.trilha_sonora_favorita}</Detail>}
          {review.momentos_favoritos && <Detail label="Momentos">{review.momentos_favoritos}</Detail>}
        </div>
      )}

      {/* ─── SEÇÃO DE COMENTÁRIOS ────────────────────────────────────────── */}

      <div className="border-t border-border pt-3 mt-2">
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition"
        >
          <MessageSquare className="h-4 w-4" />
          {commentCount} {commentCount === 1 ? 'comentário' : 'comentários'}
          <span className="text-[10px]">({showComments ? 'ocultar' : 'mostrar'})</span>
        </button>

        {showComments && (
          <div className="mt-3 space-y-3">
            {/* Input de comentário */}
            {user ? (
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden shrink-0">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {(user?.user_metadata?.full_name || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Escreva um comentário (visível apenas para amigos do autor e do comentarista)..."
                    className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={2}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendComment();
                      }
                    }}
                  />
                  <div className="flex justify-end mt-1">
                    <button
                      onClick={sendComment}
                      disabled={!commentText.trim() || sendingComment}
                      className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      {sendingComment ? '...' : <><Send className="h-3 w-3" /> Enviar</>}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Faça login para comentar</p>
            )}

            {/* Lista de comentários */}
            {loadingComments ? (
              <div className="text-xs text-muted-foreground">Carregando comentários...</div>
            ) : comments.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Nenhum comentário ainda. Seja o primeiro!</div>
            ) : (
              <div className="space-y-2">
                {comments.map(c => (
                  <CommentItem key={c.id} comment={c} isOwn={c.user_id === user?.id} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ─── COMPONENTES AUXILIARES ──────────────────────────────────────────────────

function Tag({ children, icon: Icon, className = '' }: { children: React.ReactNode; icon?: any; className?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${className || 'bg-secondary text-secondary-foreground'}`}>
      {Icon && <Icon className="h-3 w-3" />}{children}
    </span>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">{label}:</span> {children}</p>
  );
}