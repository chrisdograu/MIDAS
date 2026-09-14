import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Store, Star, ShoppingBag, Repeat, Calendar, MessageCircle, UserPlus, Ban, Flag, Edit, Lock, ShieldAlert, Share2, Clock, CheckCircle2, Verified, History, ThumbsUp, ThumbsDown } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { motion } from 'framer-motion';
import SellerProfileSwitcher from '@/components/seller/SellerProfileSwitcher';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { formatCurrency, formatMonthYear, formatDate, formatRelativeTime } from '@/lib/format';
import { toast } from 'sonner';
import { useFollow } from '@/mobile/lib/useFollow';
import { ReportDialog } from '@/components/ReportDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Seller = {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  rating: number;
  total_sales: number;
  total_trades: number;
  first_listing_at: string | null;
  created_at: string;
  vacation_mode?: boolean | null;
  admin_suspended?: boolean | null;
  vacation_message?: string | null;
  verified?: boolean;
  last_activity_at?: string | null;
};

// GAP-595: Calcular tempo médio de resposta (em dias)
async function getAverageResponseTime(sellerId: string): Promise<number | null> {
  const { data: conversations } = await supabase
    .from('conversas')
    .select('id')
    .or(`participant_1.eq.${sellerId},participant_2.eq.${sellerId}`)
    .eq('channel', 'seller')
    .limit(50);
  
  if (!conversations || conversations.length === 0) return null;
  
  const convIds = conversations.map(c => c.id);
  const { data: messages } = await supabase
    .from('mensagens')
    .select('conversation_id, sender_id, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true });
  
  if (!messages || messages.length < 2) return null;
  
  let totalResponseTime = 0;
  let responseCount = 0;
  
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    if (prev.sender_id !== sellerId && curr.sender_id === sellerId) {
      const timeDiff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
      if (timeDiff > 0 && timeDiff < 30 * 24 * 60 * 60 * 1000) { // Ignorar > 30 dias
        totalResponseTime += timeDiff;
        responseCount++;
      }
    }
  }
  
  // Retorna em dias (arredondado)
  return responseCount > 0 ? Math.round(totalResponseTime / responseCount / (1000 * 60 * 60 * 24)) : null;
}

// GAP-596: Buscar avaliações do vendedor
async function getSellerReviews(sellerId: string) {
  const { data } = await supabase
    .from('avaliacoes_usuario')
    .select('*, reviewer:reviewer_id(display_name, avatar_url)')
    .eq('reviewed_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(10);
  return data || [];
}

// GAP-600: Buscar histórico de vendas (últimas 5)
async function getSellerSalesHistory(sellerId: string) {
  const { data } = await supabase
    .from('pedidos')
    .select('id, created_at, total, status')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(5);
  return data || [];
}

export default function SellerProfile() {
  const { handle } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [personal, setPersonal] = useState<{ display_name: string | null } | null>(null);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [arrivedViaAd, setArrivedViaAd] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [acting, setActing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  
  // GAP-595: Tempo de resposta
  const [avgResponseDays, setAvgResponseDays] = useState<number | null>(null);
  
  // GAP-596: Avaliações
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  
  // GAP-600: Histórico de vendas
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);

  const { isFollowing, requested, loading: followLoading, toggle: toggleFollow } = useFollow(seller?.user_id);

  const handleMessage = async () => {
    if (!user || !seller || acting) return;
    setActing(true);
    const { data: existing } = await supabase
      .from('conversas')
      .select('id')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${seller.user_id}),and(participant_1.eq.${seller.user_id},participant_2.eq.${user.id})`)
      .eq('channel', 'seller')
      .maybeSingle();
    if (existing) {
      setActing(false);
      navigate(`/m/chat/${existing.id}`);
      return;
    }
    const { data: created, error } = await supabase
      .from('conversas')
      .insert({ participant_1: user.id, participant_2: seller.user_id, channel: 'seller' } as any)
      .select('id')
      .single();
    setActing(false);
    if (error || !created) {
      toast.error(`Não foi possível abrir a conversa: ${error?.message ?? 'erro desconhecido'}`);
      return;
    }
    navigate(`/m/chat/${created.id}`);
  };

  const handleBlock = async () => {
    if (!user || !seller || acting) return;
    setActing(true);
    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: user.id, blocked_id: seller.user_id, scope: 'seller' } as any);
    setActing(false);
    setBlockOpen(false);
    if (error) {
      toast.error(`Não foi possível bloquear: ${error.message}`);
      return;
    }
    toast.success('Vendedor bloqueado');
    setBlocked(true);
  };

  // GAP-597: Compartilhar perfil
  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${seller?.display_name || 'Vendedor'} - MIDIAS`,
          text: `Confira o perfil do vendedor ${seller?.display_name || ''} na MIDIAS!`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado para a área de transferência!');
      }
    } catch {
      // Usuário cancelou ou navegador não suporta
    }
  };

  useEffect(() => {
    if (!handle) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase
        .from('seller_profiles')
        .select('*')
        .ilike('handle', handle)
        .maybeSingle();
      if (!s) { setLoading(false); return; }
      const sellerData = s as Seller;
      setSeller(sellerData);

      if (user) {
        const { data: blk } = await supabase
          .from('blocked_users')
          .select('id')
          .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${sellerData.user_id}),and(blocker_id.eq.${sellerData.user_id},blocked_id.eq.${user.id})`)
          .eq('scope', 'seller')
          .maybeSingle();
        if (blk) { setBlocked(true); setLoading(false); return; }
      }

      const { data: a } = await supabase
        .from('anuncios')
        .select('id, title, price, status, created_at, fotos_anuncio(image_url, position)')
        .eq('seller_id', sellerData.user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(24);
      setAds((a || []) as any);
      setArrivedViaAd((a || []).length > 0);

      const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', sellerData.user_id).maybeSingle();
      setPersonal(prof as any);

      // GAP-595: Buscar tempo médio de resposta
      const avgTime = await getAverageResponseTime(sellerData.user_id);
      setAvgResponseDays(avgTime);

      // GAP-596: Buscar avaliações
      setReviewsLoading(true);
      const reviewsData = await getSellerReviews(sellerData.user_id);
      setReviews(reviewsData);
      setReviewsLoading(false);

      // GAP-600: Buscar histórico de vendas
      setSalesHistoryLoading(true);
      const salesData = await getSellerSalesHistory(sellerData.user_id);
      setSalesHistory(salesData);
      setSalesHistoryLoading(false);

      setLoading(false);
    })();
  }, [handle, user?.id]);

  useDocumentMeta({
    title: seller?.display_name ? `${seller.display_name} · Vendedor · MIDIAS` : 'Vendedor · MIDIAS',
    description: (seller?.bio || `Perfil de vendedor de ${seller?.display_name || 'usuário'} na MIDIAS.`).slice(0, 160),
    image: seller?.avatar_url || undefined,
    type: 'profile',
  });

  if (loading) {
    return <div className="container mx-auto px-4 py-20 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>;
  }
  if (!seller) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Store className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Perfil vendedor não encontrado.</p>
        <Link to="/" className="text-primary hover:underline text-sm">Voltar ao início</Link>
      </div>
    );
  }

  const isOwn = user?.id === seller.user_id;
  const showPrivateView = seller.is_private && !arrivedViaAd && !isOwn;
  const monthLabel = seller.first_listing_at
    ? formatMonthYear(seller.first_listing_at)
    : null;

  if (blocked) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Ban className="h-12 w-12 text-destructive mx-auto mb-3" />
        <p className="text-foreground font-semibold">Perfil indisponível</p>
        <p className="text-sm text-muted-foreground">Há um bloqueio ativo entre vocês.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <SellerProfileSwitcher
        userId={seller.user_id}
        personalHandle={personal?.display_name}
        sellerHandle={seller.handle}
        hasSeller={true}
        isOwn={isOwn}
      />

      {/* Cabeçalho marketplace-style */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-6 mb-5"
      >
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <div className="w-24 h-24 rounded-xl bg-accent/15 border-2 border-accent/30 overflow-hidden flex items-center justify-center shrink-0">
            {seller.avatar_url
              ? <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              : <Store className="h-10 w-10 text-accent" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-accent font-bold text-xl">$</span>
              <h1 className="text-2xl font-display font-bold truncate">{seller.display_name}</h1>
              {/* GAP-599: Badge de verificação */}
              {seller.verified && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wide bg-success/15 text-success border border-success/30 px-2 py-0.5 rounded">
                  <Verified className="h-3 w-3" /> Verificado
                </span>
              )}
              {seller.is_private && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wide bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  <Lock className="h-3 w-3" /> privado
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">${seller.handle}</p>
            {seller.bio && !showPrivateView && (
              <p className="text-sm text-foreground mt-2 line-clamp-3">{seller.bio}</p>
            )}

            {/* GAP-595: Tempo de resposta */}
            {!showPrivateView && avgResponseDays !== null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Responde em média{' '}
                  <span className="font-medium text-foreground">
                    {avgResponseDays === 0 ? 'menos de 1 dia' : `${avgResponseDays} ${avgResponseDays === 1 ? 'dia' : 'dias'}`}
                  </span>
                </span>
              </div>
            )}

            {/* GAP-598: Última atividade */}
            {seller.last_activity_at && !showPrivateView && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Clock className="h-3 w-3" />
                <span>Última atividade: {formatRelativeTime(seller.last_activity_at)}</span>
              </div>
            )}

            {/* Metas */}
            {!showPrivateView && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <Metric icon={Star} label="Avaliação" value={Number(seller.rating).toFixed(1)} accent />
                <Metric icon={ShoppingBag} label="Vendas" value={String(seller.total_sales)} />
                <Metric icon={Repeat} label="Trocas" value={String(seller.total_trades)} />
                {monthLabel && <Metric icon={Calendar} label="Vende desde" value={monthLabel} />}
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[160px]">
            {isOwn ? (
              <Link to="/vendedor/editar" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90">
                <Edit className="h-4 w-4" /> Editar
              </Link>
            ) : user ? (
              <>
                <button onClick={handleMessage} disabled={acting} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  <MessageCircle className="h-4 w-4" /> Mensagem
                </button>
                <button onClick={toggleFollow} disabled={followLoading} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50">
                  <UserPlus className="h-4 w-4" /> {isFollowing ? 'Seguindo' : requested ? 'Pedido enviado' : 'Seguir'}
                </button>
                <div className="flex gap-2">
                  <button aria-label="Bloquear vendedor" onClick={() => setBlockOpen(true)} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40">
                    <Ban className="h-3.5 w-3.5" /> Bloquear
                  </button>
                  <button onClick={() => setReportOpen(true)} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
                    <Flag className="h-3.5 w-3.5" /> Denunciar
                  </button>
                  {/* GAP-597: Compartilhar */}
                  <button aria-label="Compartilhar perfil" onClick={handleShare} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => navigate('/auth')} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold">
                Entrar para interagir
              </button>
            )}
          </div>
        </div>
      </motion.section>

      {seller.admin_suspended && (
        <div className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-destructive">Loja suspensa pela equipe MIDIAS</p>
            <p className="text-muted-foreground mt-0.5">Os anúncios estão indisponíveis enquanto a análise não terminar.</p>
          </div>
        </div>
      )}

      {seller.vacation_mode && (
        <div className="mb-5 rounded-xl border border-warning/40 bg-warning/10 p-4 flex items-start gap-3">
          <span className="text-2xl">🏖️</span>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-warning">Este vendedor está em modo férias</p>
            <p className="text-muted-foreground mt-0.5">
              {seller.vacation_message || 'Os anúncios estão temporariamente ocultos. Ele volta em breve.'}
            </p>
          </div>
        </div>
      )}

      {showPrivateView ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-semibold">Este perfil de vendedor é privado</p>
          <p className="text-sm text-muted-foreground mt-1">Você só consegue ver este vendedor ao acessá-lo por um anúncio publicado.</p>
        </div>
      ) : seller.admin_suspended ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Anúncios indisponíveis durante a suspensão.
        </div>
      ) : seller.vacation_mode && !isOwn ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-sm text-muted-foreground">
          Anúncios ocultos durante o modo férias.
        </div>
      ) : (
        <>
          {/* Anúncios ativos */}
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-accent" /> Anúncios ativos ({ads.length})
            </h2>
            {ads.length === 0 ? (
              <EstadoVazio
                icone={ShoppingBag}
                titulo="Nenhum anúncio ativo no momento"
                descricao="Volte mais tarde para conferir novos anúncios deste vendedor."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ads.map(a => {
                  const photo = (a.fotos_anuncio || []).sort((x: any, y: any) => x.position - y.position)[0];
                  return (
                    <Link key={a.id} to={`/m/marketplace/${a.id}`} className="bg-card border border-border rounded-xl overflow-hidden hover:border-accent/40 transition-colors">
                      <div className="aspect-square bg-muted">
                        {photo ? <img src={photo.image_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-8 w-8 text-muted-foreground" /></div>}
                      </div>
                      <div className="p-2.5">
                        <p className="text-sm font-medium line-clamp-1">{a.title}</p>
                        <p className="text-base font-bold text-accent mt-0.5">{formatCurrency(Number(a.price))}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* GAP-596: Avaliações do vendedor */}
          <section className="mt-6">
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-warning" /> Avaliações ({reviews.length})
            </h2>
            {reviewsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este vendedor ainda não recebeu avaliações.</p>
            ) : (
              <div className="space-y-3">
                {reviews.slice(0, 5).map((review: any) => (
                  <div key={review.id} className="bg-card border border-border rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/perfil/${review.reviewer_id}`} className="flex items-center gap-2">
                        {review.reviewer?.avatar_url ? (
                          <img src={review.reviewer.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" loading="lazy" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary/20" />
                        )}
                        <span className="text-sm font-medium">{review.reviewer?.display_name || 'Usuário'}</span>
                      </Link>
                      <span className="text-xs text-warning">{'★'.repeat(Math.round(review.rating))}{'☆'.repeat(5 - Math.round(review.rating))}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDate(review.created_at)}</span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>
                    )}
                  </div>
                ))}
                {reviews.length > 5 && (
                  <button className="text-xs text-primary hover:underline">
                    Ver mais {reviews.length - 5} avaliações
                  </button>
                )}
              </div>
            )}
          </section>

          {/* GAP-600: Histórico de vendas */}
          <section className="mt-6">
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" /> Últimas vendas
            </h2>
            {salesHistoryLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : salesHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda recente.</p>
            ) : (
              <div className="space-y-2">
                {salesHistory.map((sale: any) => (
                  <div key={sale.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Pedido #{sale.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(sale.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        sale.status === 'delivered' ? 'bg-success/10 text-success' :
                        sale.status === 'paid' ? 'bg-primary/10 text-primary' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {sale.status === 'delivered' ? 'Entregue' :
                         sale.status === 'paid' ? 'Pago' : sale.status}
                      </span>
                      <span className="font-bold text-price">{formatCurrency(Number(sale.total))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="profile"
        targetId={seller.user_id}
        label={seller.display_name}
      />

      <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear este vendedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Vocês não poderão mais se ver nem trocar mensagens no marketplace. Você pode desfazer nas configurações de bloqueios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlock} disabled={acting}>Bloquear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2.5">
      <div className={`flex items-center gap-1 text-[11px] uppercase tracking-wide ${accent ? 'text-accent' : 'text-muted-foreground'}`}>
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-base font-bold text-foreground mt-0.5 truncate capitalize">{value}</p>
    </div>
  );
}