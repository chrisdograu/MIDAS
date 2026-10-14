import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ArrowLeftRight, Send, ChevronLeft, ChevronRight, ShoppingBag, Star, Heart, X, Expand, ThumbsUp, ThumbsDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MobileBadge } from '@/mobile/lib/badge';
import { HalfStarDisplay } from '@/components/HalfStarRating';
import { useFollow } from '@/mobile/lib/useFollow';
import { toast } from 'sonner';
import { ItemActionsMenu } from '@/components/ItemActionsMenu';
import { useFavoritoAnuncio } from '@/hooks/useFavoritoAnuncio';
import EstadoVazio from '@/components/EstadoVazio';
import ErroCarregamento from '@/components/ErroCarregamento';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { Loader2 } from 'lucide-react';

interface Ad {
  id: string; title: string; description: string | null; price: number; ad_type: string;
  condition: string; certificate_type: string; created_at: string; seller_id: string;
  category: string; plataformas: string[] | null; desired_item: string | null;
  accepts_counteroffer: boolean;
}
interface Seller { id: string; display_name: string | null; avatar_url: string | null; bio: string | null; rating: number }

// GAP-1085: Lightbox para zoom
function ImageLightbox({ images, initialIndex, onClose }: { images: string[]; initialIndex: number; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  if (images.length === 0) return null;
  
  const currentImage = images[currentIndex];
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-overlay/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-on-media/70 hover:text-on-media p-2 z-10"
      >
        <X className="h-8 w-8" />
      </button>
      
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((currentIndex - 1 + images.length) % images.length); }}
            className="absolute left-4 text-on-media/70 hover:text-on-media p-2 z-10"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex((currentIndex + 1) % images.length); }}
            className="absolute right-4 text-on-media/70 hover:text-on-media p-2 z-10"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-on-media/50 text-sm">
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

// GAP-1087: Componente de avaliações do vendedor
function SellerReviews({ sellerId }: { sellerId: string }) {
  const [reviews, setReviews] = useState<{ id: string; rating: number; comment: string | null; created_at: string; reviewer_name: string; reviewer_avatar: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('avaliacoes_usuario')
        .select('id, rating, comment, created_at, reviewer:reviewer_id(display_name, avatar_url)')
        .eq('reviewed_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(10);
      setReviews((data || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        reviewer_name: r.reviewer?.display_name || 'Usuário',
        reviewer_avatar: r.reviewer?.avatar_url || null,
      })));
      setLoading(false);
    })();
  }, [sellerId]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (reviews.length === 0) return <p className="text-xs text-muted-foreground">Este vendedor ainda não recebeu avaliações.</p>;

  const visibleReviews = showAll ? reviews : reviews.slice(0, 3);

  return (
    <div className="space-y-2">
      {visibleReviews.map((r) => (
        <div key={r.id} className="flex items-start gap-2 p-2 rounded-lg bg-card/50">
          <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden shrink-0">
            {r.reviewer_avatar ? (
              <img src={r.reviewer_avatar} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {r.reviewer_name[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{r.reviewer_name}</span>
              <HalfStarDisplay rating={r.rating} size={10} />
            </div>
            {r.comment && <p className="text-xs text-muted-foreground line-clamp-2">{r.comment}</p>}
            <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      ))}
      {reviews.length > 3 && (
        <button onClick={() => setShowAll(!showAll)} className="text-xs text-primary hover:underline">
          {showAll ? 'Ver menos' : `Ver mais ${reviews.length - 3} avaliações`}
        </button>
      )}
    </div>
  );
}

export default function MMarketplaceItem() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ad, setAd] = useState<Ad | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [similar, setSimilar] = useState<{ id: string; title: string; price: number; image: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [recarregar, setRecarregar] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { isFollowing, loading: followLoading, toggle: toggleFollow } = useFollow(seller?.id);
  const { isFav, loading: favLoading, toggle: toggleFav } = useFavoritoAnuncio(id);
  const canDeleteAd = !!user && !!ad && user.id === ad.seller_id;
  const canReportAd = !!ad && (!user || user.id !== ad.seller_id);

  useEffect(() => {
    if (!id) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setErro(false);
      const { data: a, error: adErro } = await supabase.from('anuncios').select('*').eq('id', id).maybeSingle();
      if (cancel) return;
      if (adErro) { setErro(true); setLoading(false); return; }
      if (!a) { setLoading(false); return; }
      const [{ data: ph }, { data: s }, { data: revs }, { data: sim }] = await Promise.all([
        supabase.from('fotos_anuncio').select('image_url, position').eq('anuncio_id', id).order('position'),
        supabase.from('profiles').select('id, display_name, avatar_url, bio').eq('id', a.seller_id).maybeSingle(),
        supabase.from('avaliacoes_usuario').select('rating').eq('reviewed_id', a.seller_id),
        supabase.from('anuncios').select('id, title, price, seller_id').eq('status', 'active').eq('category', a.category).neq('id', id).limit(6),
      ]);
      const simIds = sim?.map(x => x.id) || [];
      const { data: simPhotos } = simIds.length
        ? await supabase.from('fotos_anuncio').select('anuncio_id, image_url, position').in('anuncio_id', simIds).order('position')
        : { data: [] as any[] };
      const simMap = new Map<string, string>();
      (simPhotos || []).forEach(p => { if (!simMap.has(p.anuncio_id)) simMap.set(p.anuncio_id, p.image_url); });
      const avg = revs?.length ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : 0;
      if (cancel) return;
      setAd(a as Ad);
      setPhotos((ph || []).map(p => p.image_url));
      setSeller(s ? { ...s, rating: avg } : null);
      setSimilar((sim || []).map(x => ({ id: x.id, title: x.title, price: Number(x.price), image: simMap.get(x.id) || null })));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [id, recarregar]);

  const handleMessage = async () => {
    if (!user) { toast.error('Faça login primeiro'); navigate('/m/auth'); return; }
    if (!ad || user.id === ad.seller_id || enviandoMensagem) return;
    setEnviandoMensagem(true);
    const { data, error } = await (supabase as any).rpc('start_conversation', {
      _other: ad.seller_id, _channel: 'seller',
    });
    setEnviandoMensagem(false);
    if (error) {
      if ((error.message || '').includes('minor_stranger_blocked')) toast.error('Contato bloqueado por regra de idade.');
      else toast.error('Não foi possível iniciar a conversa');
      return;
    }
    const row: any = data;
    if (!row?.id) { toast.error('Não foi possível iniciar a conversa'); return; }
    if (row.status === 'pending_guardian') toast.success('Contato liberado após aprovação do responsável');
    else if (row.status === 'pending') toast.success('Pedido enviado ao vendedor');
    navigate(`/m/chat/${row.id}`);
  };

  const deleteAd = async () => {
    if (!user || !ad || ad.seller_id !== user.id || excluindo) return;
    setExcluindo(true);
    const { error } = await supabase.from('anuncios').delete().eq('id', ad.id);
    setExcluindo(false);
    if (error) { toast.error('Não foi possível excluir o anúncio'); return; }
    toast.success('Anúncio excluído');
    navigate('/m/marketplace');
  };

  const openEdit = () => {
    if (!ad) return;
    navigate(`/m/marketplace/novo?edit=${ad.id}`);
  };

  // GAP-1085: Abrir lightbox
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (loading) return (
    <div className="pb-8">
      <Skeleton className="w-full aspect-square" />
      <div className="px-4 py-5 space-y-3">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
  if (erro) return (
    <ErroCarregamento
      titulo="Não foi possível carregar o anúncio"
      descricao="Verifique sua conexão e tente de novo."
      onRetry={() => setRecarregar(v => v + 1)}
    />
  );
  if (!ad) return (
    <EstadoVazio
      icone={ShoppingBag}
      titulo="Anúncio não encontrado"
      descricao="Ele pode ter sido vendido, expirado ou removido pelo vendedor."
      acao={{ label: 'Ver marketplace', to: '/m/marketplace' }}
    />
  );

  return (
    <div className="pb-8">
      <button onClick={() => navigate(-1)} className="px-4 py-3 flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</button>

      {/* GAP-1085: Galeria com lightbox */}
      <div className="relative aspect-square bg-muted">
        {photos.length > 0 ? (
          <>
            <img 
              src={photos[photoIdx]} 
              alt={ad.title} 
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => openLightbox(photoIdx)}
            />
            <button
              onClick={() => openLightbox(photoIdx)}
              className="absolute bottom-3 right-3 p-1.5 rounded-full bg-overlay/50 text-on-media/70 hover:text-on-media"
            >
              <Expand className="h-4 w-4" />
            </button>
            {photos.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setPhotoIdx((photoIdx - 1 + photos.length) % photos.length); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full overlay-scrim text-on-media flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); setPhotoIdx((photoIdx + 1) % photos.length); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full overlay-scrim text-on-media flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
                  {photos.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === photoIdx ? 'w-6 bg-primary' : 'w-1.5 bg-foreground/40'}`} />)}
                </div>
              </>
            )}
          </>
        ) : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-12 w-12 text-muted-foreground" /></div>}
      </div>

      {/* GAP-1085: Lightbox */}
      <AnimatePresence>
        {lightboxOpen && photos.length > 0 && (
          <ImageLightbox
            images={photos}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="px-4 py-5 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {ad.certificate_type !== 'sem_certificado' && <MobileBadge tone="success"><ShieldCheck className="h-3 w-3" />Protegido pela loja</MobileBadge>}
          {ad.ad_type === 'troca' && <MobileBadge tone="accent"><ArrowLeftRight className="h-3 w-3" />Troca</MobileBadge>}
          <MobileBadge tone="muted">{({ novo: '✨ Novo', seminovo: '🌟 Seminovo', usado: '📦 Usado', recondicionado: '🔧 Recondicionado' } as Record<string, string>)[ad.condition] || ad.condition}</MobileBadge>
          {ad.accepts_counteroffer && <MobileBadge tone="warning">💬 Aceita contraoferta</MobileBadge>}
        </div>

        <div>
          <h1 className="text-xl font-bold text-foreground">{ad.title}</h1>
          <p className="text-3xl font-bold text-price mt-1">{formatCurrency(ad.price)}</p>
          {ad.desired_item && (
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-semibold text-accent">Procura por:</span> {ad.desired_item}
            </p>
          )}
        </div>

        {ad.description && (
          <div className="glass rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Descrição</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap">{ad.description}</p>
          </div>
        )}

        {ad.plataformas && ad.plataformas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ad.plataformas.map(p => <MobileBadge key={p} tone="primary">{p}</MobileBadge>)}
          </div>
        )}

        {seller && (
          <div className="glass rounded-xl p-3 flex items-center gap-3">
            <Link to={`/m/perfil/${seller.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground font-bold shrink-0">
                {seller.avatar_url ? <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" /> : seller.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{seller.display_name || 'Vendedor'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <HalfStarDisplay rating={seller.rating} size={11} />
                  <span className="text-[11px] text-muted-foreground">{seller.rating > 0 ? seller.rating.toFixed(1) : 'sem avaliações'}</span>
                </div>
              </div>
            </Link>
            {user && user.id !== seller.id && (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${isFollowing ? 'bg-secondary text-foreground border border-border' : 'bg-gradient-to-r from-primary to-accent text-primary-foreground'}`}
              >
                {isFollowing ? 'Seguindo' : '+ Seguir'}
              </button>
            )}
          </div>
        )}

        {/* GAP-1087: Avaliações do vendedor */}
        {seller && (
          <div className="glass rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-warning" /> Avaliações do vendedor
            </h3>
            <SellerReviews sellerId={seller.id} />
          </div>
        )}

        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-[11px] text-foreground/90">
          <p className="font-semibold text-warning mb-1">⚠️ Troca segura</p>
          <p>
            Combine tudo dentro do chat da MIDIAS — nunca envie dinheiro fora da plataforma nem passe telefone/e-mail no primeiro contato.
            {' '}
            {ad.certificate_type !== 'sem_certificado'
              ? 'Este anúncio tem Certificado de Proteção da loja: qualquer problema, abra uma disputa aqui.'
              : 'Este anúncio não tem Certificado de Proteção — em caso de golpe, denuncie o vendedor imediatamente.'}
          </p>
          {(ad.ad_type === 'troca' || ad.price >= 300) && (
            <p className="mt-2 pt-2 border-t border-warning/30">
              <span className="font-semibold">Entrega presencial?</span> Prefira encontrar em <span className="font-semibold">delegacia com zona de troca segura</span> ou em local público com câmera de segurança (shopping, agência de correios). É gratuito, opcional, e protege os dois lados.
            </p>
          )}
          <p className="mt-2 pt-2 border-t border-warning/30">
            <span className="font-semibold">Print de comprovante não é pagamento.</span> Só envie o item depois de ver o valor
            realmente creditado na sua conta ou o pedido confirmado aqui no app — comprovantes e capturas de tela são facilmente falsificados.
          </p>
        </div>

        <div className="flex gap-2 items-center">
          {user && user.id !== ad.seller_id && (
            <>
              <button onClick={handleMessage} type="button" disabled={enviandoMensagem} className="disabled:opacity-50 flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold glow-primary">
                <Send className="h-4 w-4" /> Mandar mensagem
              </button>
              <button onClick={toggleFav} disabled={favLoading} type="button"
                aria-label={isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                className={`px-4 py-3 rounded-xl border transition-colors ${isFav ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-card border-border text-muted-foreground hover:text-primary'}`}>
                <Heart className={`h-5 w-5 ${isFav ? 'fill-primary' : ''}`} />
              </button>
            </>
          )}
          <ItemActionsMenu
            copyText={`${ad.title} — ${formatCurrency(ad.price)}`}
            shareUrl={`/m/marketplace/${ad.id}`}
            canEdit={canDeleteAd}
            onEdit={openEdit}
            canDelete={canDeleteAd}
            onDelete={deleteAd}
            deleteConfirm="Excluir este anúncio?"
            reportType={canReportAd ? 'anuncio' : undefined}
            reportTargetId={ad.id}
            reportLabel="anúncio"
            className="px-3 py-3 rounded-xl bg-card border border-border"
            iconClassName="h-5 w-5"
          />
        </div>

        <section>
            <h3 className="text-sm font-bold mb-2">Itens parecidos</h3>
            {similar.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum item parecido por aqui ainda.</p>
            ) : (
            <div className="flex gap-2 overflow-x-auto scrollbar-thin -mx-4 px-4 pb-1">
              {similar.map(s => (
                <Link key={s.id} to={`/m/marketplace/${s.id}`} className="shrink-0 w-32 glass rounded-lg overflow-hidden">
                  <div className="aspect-square bg-muted">
                    {s.image ? <img src={s.image} alt={s.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-6 w-6 text-muted-foreground" /></div>}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-semibold line-clamp-2 leading-tight min-h-[28px]">{s.title}</p>
                    <p className="text-xs font-bold text-price mt-0.5">{formatCurrency(s.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
            )}
          </section>
      </div>
    </div>
  );
}