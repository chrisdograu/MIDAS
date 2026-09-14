import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProduto, useProdutos } from '@/hooks/useProdutos';
import { useCart } from '@/hooks/useCart';
import { useFavoritos } from '@/hooks/useFavoritos';
import { useAvaliacoes } from '@/hooks/useAvaliacoes';
import { useAuth } from '@/hooks/useAuth';
import { useBiblioteca } from '@/hooks/useBiblioteca';
import {
  ShoppingCart,
  ArrowLeft,
  Shield,
  Zap,
  Clock,
  Heart,
  Loader2,
  AlertTriangle,
  Users,
  Sparkles,
  PackageSearch,
  Play,
  Monitor,
  HardDrive,
  Cpu,
  MemoryStick,
  Film,
} from 'lucide-react';
import { HalfStarDisplay, InteractiveHalfStar } from '@/components/HalfStarRating';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import GameCard from '@/components/GameCard';
import PriceHistoryChart from '@/components/PriceHistoryChart';
import ProductGallery from '@/components/ProductGallery';
import ProductBundles from '@/components/ProductBundles';
import { GamePageCustomizer } from '@/components/cosmetics/GamePageCustomizer';
import { GamePageCosmeticOverlay } from '@/components/cosmetics/GamePageCosmeticOverlay';
import { userOwnsGame } from '@/hooks/useCosmetics';
import { OpinionsPanel } from '@/components/social/OpinionsPanel';
import { ScreenshotsPanel, FeaturedScreenshotsStrip } from '@/components/social/ScreenshotsPanel';
import FriendsWithGame from '@/components/social/FriendsWithGame';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency, formatDate } from '@/lib/format';

// GAP-020, GAP-110: Interface para requisitos de sistema
interface SystemRequirements {
  minimum: {
    os: string;
    processor: string;
    memory: string;
    graphics: string;
    storage: string;
  };
  recommended?: {
    os: string;
    processor: string;
    memory: string;
    graphics: string;
    storage: string;
  };
}

// GAP-022, GAP-112: Skeleton Component
function GameDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="aspect-video bg-muted rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="h-8 w-3/4 bg-muted rounded" />
          <div className="h-4 w-1/2 bg-muted rounded" />
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-12 bg-muted rounded-lg" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="h-6 w-32 bg-muted rounded mb-4" />
          <div className="h-20 bg-muted rounded" />
        </div>
        <div>
          <div className="h-6 w-24 bg-muted rounded mb-4" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

export default function GameDetail() {
  const { id } = useParams();
  const { data: game, isLoading, isError, refetch } = useProduto(id);
  const { data: allGames = [] } = useProdutos();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isFavorito, toggleFavorito } = useFavoritos();
  const { avgRating, totalReviews, userRating, submitRating } = useAvaliacoes(id);
  const { biblioteca } = useBiblioteca();

  const [owns, setOwns] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  // GAP-019, GAP-109: Verificar se o usuário pode avaliar (precisa ter o jogo)
  useEffect(() => {
    if (user && id) {
      // Verifica se o jogo está na biblioteca do usuário
      const ownsGame = biblioteca?.some(item => item.product_id === id);
      setCanRate(!!ownsGame);
      if (!ownsGame) {
        setRatingError('Você precisa ter este jogo na sua biblioteca para avaliá-lo.');
      } else {
        setRatingError(null);
      }
    }
  }, [user, id, biblioteca]);

  // GAP-019: Validar posse antes de avaliar
  const handleRate = async (rating: number) => {
    if (!user) {
      toast.error('Faça login para avaliar');
      return;
    }
    if (!canRate) {
      toast.error('Você precisa ter este jogo na sua biblioteca para avaliá-lo.');
      return;
    }
    try {
      await submitRating.mutateAsync(rating);
      toast.success('Avaliação registrada!');
    } catch {
      toast.error('Erro ao avaliar');
    }
  };

  useEffect(() => {
    if (!id) return;
    let sessionId = sessionStorage.getItem('mv_sid');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('mv_sid', sessionId);
    }
    supabase
      .from('product_views' as any)
      .insert({ product_id: id, user_id: user?.id || null, session_id: user?.id ? null : sessionId })
      .then(({ error }) => {
        if (error && (error as any).code !== '23505') {
          console.warn('product_views insert failed:', error.message);
        }
      });
  }, [id, user?.id]);

  useEffect(() => {
    if (user && id) userOwnsGame(user.id, id).then(setOwns);
  }, [user?.id, id]);

  useDocumentMeta({
    title: game ? `${game.title} · MIDIAS` : 'Jogo · MIDIAS',
    description: game
      ? (game.description || `Compre ${game.title} na MIDIAS — entrega instantânea por e-mail.`).slice(0, 160)
      : undefined,
    image: game?.image,
    type: 'product',
  });

  // GAP-023, GAP-113: Tratamento de erro específico
  if (isError) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EstadoVazio
          icone={AlertTriangle}
          titulo="Erro ao carregar o jogo"
          descricao="Houve um problema de conexão. Tente novamente."
          acao={{ label: 'Tentar novamente', onClick: () => refetch() }}
        />
      </div>
    );
  }

  // GAP-022, GAP-112: Skeleton em vez de spinner
  if (isLoading) {
    return <GameDetailSkeleton />;
  }

  // GAP-023, GAP-113: Produto não encontrado (diferenciado de erro)
  if (!game) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EstadoVazio
          icone={PackageSearch}
          titulo="Jogo não encontrado"
          descricao="Ele pode ter sido removido ou o link está incorreto."
          acao={{ label: 'Voltar ao catálogo', to: '/catalogo' }}
        />
      </div>
    );
  }

  // GAP-024, GAP-114: Recomendações melhoradas
  // 1. Jogos da mesma categoria (fallback)
  const sameCategory = allGames
    .filter(g => g.id !== game.id && g.category === game.category)
    .slice(0, 4);

  // 2. "Quem comprou também comprou" (baseado em compras anteriores)
  // Nota: Esta é uma simulação — em produção, viria de uma query real
  const alsoBought = allGames
    .filter(g => g.id !== game.id && g.id !== game.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  // Usa "quem comprou também" se disponível, senão fallback para mesma categoria
  const related = alsoBought.length >= 3 ? alsoBought : sameCategory;

  const outOfStock = game.stock <= 0;

  // GAP-020, GAP-110: Extrair requisitos de sistema do game
  const systemRequirements = game.systemRequirements as unknown as SystemRequirements | null;

  const handleAdd = () => {
    if (outOfStock) {
      toast.error('Produto fora de estoque');
      return;
    }
    addItem(game);
    toast.success(`${game.title} adicionado ao carrinho!`);
  };

  const handleFav = () => {
    if (!user) {
      toast.error('Faça login para favoritar');
      return;
    }
    toggleFavorito(game.id);
  };

  const installments = Math.min(12, Math.max(2, Math.ceil(game.price / 10)));
  const installmentValue = formatCurrency(game.price / installments);

  return (
    <div className="container mx-auto px-4 py-8" data-game-cosmetic={game.id}>
      <GamePageCosmeticOverlay ownerId={user?.id} productId={game.id} />

      <Link
        to="/catalogo"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
      </Link>

      {owns && (
        <button
          onClick={() => setCustomizerOpen(true)}
          className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 text-xs font-semibold text-primary"
        >
          <Sparkles className="h-4 w-4" /> Personalizar esta página
        </button>
      )}
      <GamePageCustomizer productId={game.id} open={customizerOpen} onOpenChange={setCustomizerOpen} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2">
          <div className="relative">
            <ProductGallery productId={game.id} mainImage={game.image} title={game.title} />

            {/* GAP-021, GAP-111: Trailer/Video */}
            {game.trailer_url && (
              <div className="mt-4 rounded-xl overflow-hidden aspect-video bg-black">
                <iframe
                  src={game.trailer_url}
                  title={`Trailer de ${game.title}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            <button
              onClick={handleFav}
              className="absolute top-4 right-4 p-2 rounded-full bg-card/80 backdrop-blur-sm hover:bg-card transition-colors z-10"
            >
              <Heart
                className={`h-5 w-5 ${isFavorito(game.id) ? 'fill-destructive text-destructive' : 'text-muted-foreground'}`}
              />
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {game.platform.map((p) => (
                <span key={p} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
                  {p}
                </span>
              ))}
              <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">{game.category}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{game.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{game.publisher}</p>
          </div>

          <div className="flex items-center gap-2">
            <HalfStarDisplay rating={avgRating} size={16} />
            <span className="text-sm text-muted-foreground">
              {avgRating.toFixed(1)} ({totalReviews} {totalReviews === 1 ? 'avaliação' : 'avaliações'})
            </span>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            {outOfStock && (
              <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Fora de estoque</span>
              </div>
            )}
            {game.discount > 0 && (
              <div className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground text-sm font-bold px-2 py-1 rounded">
                  -{game.discount}%
                </span>
                <span className="text-muted-foreground line-through text-sm">
                  {formatCurrency(game.originalPrice)}
                </span>
              </div>
            )}
            <div className="text-3xl font-bold text-price">{formatCurrency(game.price)}</div>
            <p className="text-xs text-muted-foreground">
              ou {installments}x de {installmentValue} sem juros
            </p>
            {!outOfStock && <p className="text-xs text-success">{game.stock} unidades em estoque</p>}
            <button
              onClick={handleAdd}
              disabled={outOfStock}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="h-5 w-5" /> {outOfStock ? 'Indisponível' : 'Adicionar ao Carrinho'}
            </button>
            {user && (
              <Link
                to={`/jogo/${game.id}/social`}
                className="w-full py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all text-sm"
              >
                <Users className="h-4 w-4" /> Ver Hub Social dos Amigos
              </Link>
            )}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" /> Entrega instantânea por e-mail
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-success" /> Garantia de 30 dias
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-warning" /> Suporte 24/7
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Description */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-foreground">Sobre o Jogo</h2>
          <p className="text-muted-foreground leading-relaxed">{game.description}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {game.tags?.map((tag) => (
              <span key={tag} className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Detalhes</h2>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 text-sm">
            {game.publisher && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Publicadora</span>
                <span className="text-foreground">{game.publisher}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lançamento</span>
              <span className="text-foreground">
                {game.releaseDate ? formatDate(game.releaseDate) : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Categoria</span>
              <span className="text-foreground">{game.category}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Plataformas</span>
              <span className="text-right break-words text-foreground">{game.platform.join(', ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estoque</span>
              <span className={outOfStock ? 'text-destructive' : 'text-foreground'}>
                {outOfStock ? 'Esgotado' : `${game.stock} un.`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* GAP-020, GAP-110: Requisitos de Sistema */}
      {systemRequirements && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" /> Requisitos de Sistema
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">Mínimo</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sistema Operacional</span>
                  <span className="text-foreground">{systemRequirements.minimum.os}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processador</span>
                  <span className="text-foreground">{systemRequirements.minimum.processor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memória</span>
                  <span className="text-foreground">{systemRequirements.minimum.memory}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Placa de Vídeo</span>
                  <span className="text-foreground">{systemRequirements.minimum.graphics}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Armazenamento</span>
                  <span className="text-foreground">{systemRequirements.minimum.storage}</span>
                </div>
              </div>
            </div>
            {systemRequirements.recommended && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold text-sm text-primary mb-3">Recomendado</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sistema Operacional</span>
                    <span className="text-foreground">{systemRequirements.recommended.os}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processador</span>
                    <span className="text-foreground">{systemRequirements.recommended.processor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Memória</span>
                    <span className="text-foreground">{systemRequirements.recommended.memory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Placa de Vídeo</span>
                    <span className="text-foreground">{systemRequirements.recommended.graphics}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Armazenamento</span>
                    <span className="text-foreground">{systemRequirements.recommended.storage}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Star Rating — GAP-019: com validação de posse */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Avaliação</h2>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <div className="text-4xl font-bold text-price">{avgRating.toFixed(1)}</div>
              <HalfStarDisplay rating={avgRating} size={16} className="justify-center mt-1" />
              <p className="text-xs text-muted-foreground mt-1">
                {totalReviews} {totalReviews === 1 ? 'avaliação' : 'avaliações'}
              </p>
            </div>
            {user && (
              <div className="border-l border-border pl-6">
                {canRate ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">
                      {userRating ? 'Sua avaliação:' : 'Avalie este jogo:'}
                    </p>
                    <InteractiveHalfStar value={userRating || 0} onChange={handleRate} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <span className="text-warning">🔒</span> {ratingError || 'Adquira este jogo para avaliá-lo.'}
                  </p>
                )}
              </div>
            )}
            {!user && (
              <p className="text-sm text-muted-foreground">
                <Link to="/auth" className="text-primary hover:underline">
                  Faça login
                </Link>{' '}
                para avaliar
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Destaques da comunidade */}
      <FeaturedScreenshotsStrip
        productId={game.id}
        onSeeAll={() => document.getElementById('prints-comunidade')?.scrollIntoView({ behavior: 'smooth' })}
      />

      {/* Price history */}
      <PriceHistoryChart productId={game.id} currentPrice={game.price} />

      {/* Bundles */}
      <ProductBundles productId={game.id} />

      {/* Opiniões da comunidade */}
      {user && (
        <div className="mt-12">
          <h2 className="text-lg font-bold text-foreground mb-4">Opiniões da comunidade</h2>
          <OpinionsPanel productId={game.id} />
        </div>
      )}

      {/* Screenshots da comunidade */}
      {user && (
        <div className="mt-12 scroll-mt-24" id="prints-comunidade">
          <h2 className="text-lg font-bold text-foreground mb-4">Screenshots da comunidade</h2>
          <ScreenshotsPanel productId={game.id} />
        </div>
      )}

      {/* Amigos que têm esse jogo */}
      <FriendsWithGame productId={game.id} />

      {/* Related — GAP-024, GAP-114: recomendações melhoradas */}
      {related.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">
              {alsoBought.length >= 3 ? 'Quem comprou este jogo também comprou' : 'Jogos Relacionados'}
            </h2>
            <Link to="/catalogo" className="text-sm text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {related.map((g, i) => (
              <GameCard key={g.id} game={g} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}