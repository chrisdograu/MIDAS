import { Link } from "react-router-dom";
import { Game } from "@/lib/gameData";
import { useCart } from "@/hooks/useCart";
import { ShoppingCart, Heart, Eye, Sparkles } from "lucide-react";
import { HalfStarDisplay } from "@/components/HalfStarRating";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { usePrefetchRoute } from "@/hooks/usePrefetchRoute";
import { supabase } from "@/integrations/supabase/client";
import { mapProdutoToGame } from "@/lib/gameData";
import { formatCurrency } from "@/lib/format";
import { useState } from "react";
import { cn } from "@/lib/utils";

// GAP-GC03: Quick View Modal
interface QuickViewModalProps {
  game: Game;
  onClose: () => void;
}

function QuickViewModal({ game, onClose }: QuickViewModalProps) {
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    setIsAdding(true);
    addItem(game);
    toast.success(`${game.title} adicionado ao carrinho!`);
    setTimeout(() => setIsAdding(false), 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video">
          <img src={game.image} alt={game.title} className="w-full h-full object-cover rounded-t-xl" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
          >
            <span className="sr-only">Fechar</span>
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          <h3 className="text-xl font-bold">{game.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <HalfStarDisplay rating={game.rating} size={16} />
            <span className="text-sm text-muted-foreground">{game.rating.toFixed(1)}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{game.description}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {game.platform.map((p) => (
              <span key={p} className="text-xs bg-secondary px-2 py-1 rounded">
                {p}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div>
              <span className="text-2xl font-bold text-price">{formatCurrency(game.price)}</span>
              {game.originalPrice > game.price && (
                <span className="ml-2 text-sm text-muted-foreground line-through">
                  {formatCurrency(game.originalPrice)}
                </span>
              )}
            </div>
            <button
              onClick={handleAdd}
              disabled={isAdding || game.stock <= 0}
              className="px-6 py-2.5 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {game.stock <= 0 ? "Esgotado" : isAdding ? "Adicionando..." : "Comprar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface GameCardProps {
  game: Game;
  index?: number;
  /** GAP-GC01: Estado de loading */
  loading?: boolean;
  /** GAP-GC02: Estado da wishlist */
  isWishlisted?: boolean;
  /** GAP-GC02: Callback ao toggle wishlist */
  onWishlistToggle?: (game: Game) => void;
  /** GAP-GC04: Mostrar badge de novo */
  showNewBadge?: boolean;
}

function platformClass(p: string) {
  const k = p.toLowerCase();
  if (k.includes("ps") || k.includes("playstation")) return "platform-ps";
  if (k.includes("xbox")) return "platform-xbox";
  if (k.includes("switch") || k.includes("nintendo")) return "platform-switch";
  if (k.includes("pc") || k.includes("steam") || k.includes("win")) return "platform-pc";
  return "";
}

export default function GameCard({
  game,
  index = 0,
  loading = false,
  isWishlisted = false,
  onWishlistToggle,
  showNewBadge = false,
}: GameCardProps) {
  const { addItem } = useCart();
  const [isHovered, setIsHovered] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const outOfStock = game.stock <= 0;
  const qc = useQueryClient();
  const prefetchRoute = usePrefetchRoute();

  // GAP-GC01: Estado de loading — FIX: h-full para ocupar a célula do grid
  if (loading) {
    return (
      <div className="h-full bg-card rounded-lg overflow-hidden border border-border animate-pulse flex flex-col">
        <div className="aspect-[3/4] bg-muted shrink-0" />
        <div className="p-3 space-y-2 flex-1">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-5 bg-muted rounded w-1/3" />
        </div>
      </div>
    );
  }

  // GAP-GC02: Wishlist toggle
  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isWishlistLoading) return;

    setIsWishlistLoading(true);
    try {
      await onWishlistToggle?.(game);
      toast.success(isWishlisted ? "Removido dos favoritos" : "Adicionado aos favoritos");
    } catch {
      toast.error("Erro ao atualizar favoritos");
    } finally {
      setIsWishlistLoading(false);
    }
  };

  // GAP-GC03: Quick View
  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowQuickView(true);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) {
      toast.error("Produto fora de estoque");
      return;
    }
    addItem(game);
    toast.success(`${game.title} adicionado ao carrinho!`);
  };

  const handlePrefetch = () => {
    prefetchRoute("/jogo");
    qc.prefetchQuery({
      queryKey: ["produto", game.id],
      queryFn: async () => {
        const { data } = await supabase.from("produtos").select("*").eq("id", game.id).maybeSingle();
        return data ? mapProdutoToGame(data) : null;
      },
      staleTime: 60_000,
    });
  };

  // GAP-GC04: Verificar se é novo (últimos 7 dias)
  const isNew =
    showNewBadge &&
    (() => {
      if (!game.createdAt) return false;
      const diff = Date.now() - new Date(game.createdAt).getTime();
      return diff < 7 * 24 * 60 * 60 * 1000;
    })();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        // FIX: h-full para esticar até a altura da célula do grid
        className="h-full"
      >
        <Link
          to={`/jogo/${game.id}`}
          // FIX: h-full para o Link preencher o motion.div
          className="group block h-full"
          onMouseEnter={handlePrefetch}
          onTouchStart={handlePrefetch}
        >
          {/* FIX: h-full + flex-col para o card esticar e distribuir o conteúdo */}
          <div
            className={cn(
              "neon-border-hover relative bg-card rounded-lg overflow-hidden border border-border transition-all duration-300 h-full flex flex-col",
              outOfStock && "opacity-60",
            )}
          >
            {/* FIX: shrink-0 — a imagem não encolhe, mantém aspect fixo */}
            <div className="relative aspect-[3/4] overflow-hidden shrink-0">
              <img
                src={game.image}
                alt={game.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              {/* GAP-GC04: Badge de novo */}
              {isNew && (
                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full z-10 shadow-md flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> NOVO
                </div>
              )}

              {game.discount > 0 && !isNew && (
                <div className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-full z-10 shadow-md">
                  🔥 {game.discount}% OFF
                </div>
              )}

              {outOfStock && (
                <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-md z-10">
                  Esgotado
                </div>
              )}

              {/* GAP-GC02: Botão de wishlist */}
              {onWishlistToggle && !outOfStock && (
                <button
                  onClick={handleWishlistToggle}
                  disabled={isWishlistLoading}
                  className={cn(
                    "absolute top-2 right-2 p-2 bg-card/80 backdrop-blur-sm rounded-lg z-10 transition-all",
                    isHovered || isWishlisted ? "opacity-100" : "opacity-0",
                    "hover:scale-110",
                    isWishlisted ? "text-red-500" : "text-muted-foreground hover:text-red-500",
                  )}
                  aria-label={isWishlisted ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                >
                  <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
                </button>
              )}

              {/* GAP-GC03: Botão de quick view */}
              {!outOfStock && (
                <button
                  onClick={handleQuickView}
                  className={cn(
                    "absolute bottom-2 right-2 p-2 bg-card/80 backdrop-blur-sm rounded-lg z-10 transition-all",
                    isHovered ? "opacity-100" : "opacity-0",
                    "hover:bg-primary hover:text-primary-foreground",
                  )}
                  aria-label="Visualização rápida"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={handleAddToCart}
                aria-label="Adicionar ao carrinho"
                className={cn(
                  "absolute bottom-2 left-2 p-2 bg-card/80 backdrop-blur-sm rounded-lg z-10 transition-all",
                  isHovered || !outOfStock ? "opacity-100" : "opacity-0",
                  "hover:bg-primary hover:text-primary-foreground",
                )}
                disabled={outOfStock}
              >
                <ShoppingCart className="h-4 w-4" />
              </button>

              <div className="absolute bottom-2 left-2 flex gap-1 z-10 ml-12">
                {game.platform.map((p) => (
                  <span key={p} className={`platform-pill ${platformClass(p)}`}>
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* FIX: flex-1 + flex-col + min-h-0 — o corpo absorve a sobra e permite o mt-auto empurrar preço */}
            <div className="p-3 relative z-[2] flex-1 flex flex-col min-h-0">
              {/* FIX: min-h reserva sempre 2 linhas (leading-tight ≈ 1.25rem por linha → 2 linhas = 2.5rem) */}
              <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-tight mb-1 min-h-[2.5rem] group-hover:text-primary transition-colors">
                {game.title}
              </h3>
              <div className="flex items-center gap-1 mb-1">
                <HalfStarDisplay rating={game.rating} size={12} />
                <span className="text-[10px] text-muted-foreground">{game.rating.toFixed(1)}</span>
              </div>
              {/* FIX: mt-auto empurra os preços para o rodapé, alinhando todos os cards */}
              <div className="flex items-end gap-2 mt-auto">
                <span className="text-lg font-bold text-price">{formatCurrency(game.price)}</span>
                {game.originalPrice > game.price && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatCurrency(game.originalPrice)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* GAP-GC03: Quick View Modal */}
      {showQuickView && <QuickViewModal game={game} onClose={() => setShowQuickView(false)} />}
    </>
  );
}
