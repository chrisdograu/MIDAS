import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package, ChevronLeft, ChevronRight, Share2, Loader2, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Bundle { id: string; title: string; description: string | null; price: number; image_url: string | null; }
interface Item { bundle_id: string; product_id: string; }

interface Props { 
  productId: string;
  /** GAP-PB01: Modo carrossel */
  carousel?: boolean;
  /** GAP-PB01: Limite de itens por vez */
  itemsPerView?: number;
  /** GAP-PB02: Mostrar skeleton */
  showSkeleton?: boolean;
  /** GAP-PB03: Habilitar compartilhamento */
  enableShare?: boolean;
  /** GAP-PB04: Mostrar comparação de preços */
  showPriceComparison?: boolean;
}

// GAP-PB02: Skeleton
const BundleSkeleton = () => (
  <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0 flex-1">
        <div className="h-5 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2 mt-1" />
      </div>
      <div className="h-6 w-12 bg-muted rounded" />
    </div>
    <div className="flex gap-2 mb-3 overflow-x-auto">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="shrink-0 w-16">
          <div className="w-16 h-20 bg-muted rounded" />
          <div className="h-3 bg-muted rounded w-12 mt-1 mx-auto" />
        </div>
      ))}
    </div>
    <div className="flex items-center gap-2 pt-2 border-t border-border">
      <div className="h-5 w-16 bg-muted rounded" />
      <div className="h-6 w-20 bg-muted rounded" />
    </div>
  </div>
);

export default function ProductBundles({ 
  productId, 
  carousel = false,
  itemsPerView = 3,
  showSkeleton = true,
  enableShare = true,
  showPriceComparison = false,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ['product-bundles', productId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: items } = await supabase.from('bundle_items' as any).select('bundle_id, product_id');
      if (!items) return [];
      const myBundleIds = (items as unknown as Item[]).filter(i => i.product_id === productId).map(i => i.bundle_id);
      if (myBundleIds.length === 0) return [];
      const { data: bds } = await supabase
        .from('bundles' as any)
        .select('id, title, description, price, image_url')
        .in('id', myBundleIds)
        .eq('is_active', true);
      if (!bds || bds.length === 0) return [];
      const allProductIds = (items as unknown as Item[]).filter(i => myBundleIds.includes(i.bundle_id)).map(i => i.product_id);
      const { data: prods } = await supabase.from('produtos').select('id, title, price, image_url').in('id', allProductIds);
      const prodMap = new Map((prods || []).map(p => [p.id, p]));
      return (bds as unknown as Bundle[]).map(b => ({
        b,
        products: (items as unknown as Item[]).filter(i => i.bundle_id === b.id).map(i => prodMap.get(i.product_id)).filter(Boolean) as any[],
      }));
    },
  });

  // GAP-PB02: Loading
  if (isLoading && showSkeleton) {
    return (
      <div className="mt-12">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-bold text-foreground">Carregando pacotes...</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <BundleSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (bundles.length === 0) return null;

  // GAP-PB01: Carrossel
  const totalItems = bundles.length;
  const visibleItems = Math.min(itemsPerView, totalItems);
  const canScroll = carousel && totalItems > visibleItems;

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(totalItems - visibleItems, prev + 1));
  };

  // GAP-PB03: Compartilhar bundle
  const handleShare = async (bundle: any) => {
    const url = `${window.location.origin}/bundle/${bundle.b.id}`;
    const text = `Confira o bundle "${bundle.b.title}" na MIDIAS!`;
    
    try {
      if (navigator.share) {
        await navigator.share({ title: bundle.b.title, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success('Link do bundle copiado!');
      }
    } catch {
      // Usuário cancelou
    }
  };

  // GAP-PB04: Comparação de preços
  const comparePrices = (products: any[], bundlePrice: number) => {
    const total = products.reduce((s, p) => s + Number(p.price), 0);
    const savings = Math.max(0, total - bundlePrice);
    return { total, savings, percentage: total > 0 ? Math.round((savings / total) * 100) : 0 };
  };

  const renderBundle = (item: any, index: number) => {
    const { b, products } = item;
    const { total, savings, percentage } = comparePrices(products, Number(b.price));

    return (
      <div key={b.id} className={cn(
        "bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors",
        carousel && "min-w-full"
      )}>
        <Link to={`/bundle/${b.id}`} className="block">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground">{b.title}</h3>
              {b.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{b.description}</p>
              )}
            </div>
            {percentage > 0 && (
              <span className="bg-price text-price-foreground text-xs font-bold px-2 py-1 rounded shrink-0">
                −{percentage}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3 overflow-x-auto">
            {products.slice(0, 6).map(p => (
              <div key={p.id} className="shrink-0 w-16 text-center">
                <img 
                  src={p.image_url || ''} 
                  alt={p.title} 
                  className="w-16 h-20 object-cover rounded"
                  loading="lazy" 
                />
                <p className="text-[10px] text-muted-foreground truncate mt-1">{p.title}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-baseline gap-2">
              {savings > 0 && (
                <span className="text-xs text-muted-foreground line-through">{formatCurrency(total)}</span>
              )}
              <span className="text-price font-bold text-lg">{formatCurrency(Number(b.price))}</span>
              {savings > 0 && (
                <span className="text-xs text-success">economiza {formatCurrency(savings)}</span>
              )}
            </div>
            
            {/* GAP-PB03: Botão de compartilhar */}
            {enableShare && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShare(item);
                }}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Compartilhar bundle"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* GAP-PB04: Comparação de preços */}
          {showPriceComparison && savings > 0 && (
            <div className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Comprando separado: {formatCurrency(total)}
              <span className="mx-1">·</span>
              Economia: <span className="text-success font-semibold">{formatCurrency(savings)}</span>
            </div>
          )}
        </Link>
      </div>
    );
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Disponível em Pacotes</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {bundles.length}
          </span>
        </div>
        
        {/* GAP-PB01: Navegação do carrossel */}
        {canScroll && (
          <div className="flex gap-1">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= totalItems - visibleItems}
              className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {carousel ? (
        <div 
          ref={containerRef}
          className="overflow-hidden"
        >
          <div 
            className="flex transition-transform duration-300 ease-in-out gap-3"
            style={{ transform: `translateX(-${currentIndex * (100 / visibleItems)}%)` }}
          >
            {bundles.map((item, idx) => (
              <div key={item.b.id} className="min-w-[calc(100%/3-8px)]">
                {renderBundle(item, idx)}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-1 mt-3">
            {Array.from({ length: Math.max(1, Math.ceil(totalItems / visibleItems)) }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx * visibleItems)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  currentIndex === idx * visibleItems 
                    ? "w-6 bg-primary" 
                    : "w-3 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {bundles.map((item, idx) => renderBundle(item, idx))}
        </div>
      )}
    </div>
  );
}