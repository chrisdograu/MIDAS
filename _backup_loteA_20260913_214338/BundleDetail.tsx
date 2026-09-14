import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Package, Loader2, ShoppingCart, ArrowLeft, PackageSearch, Share2, Star, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { Button } from '@/components/ui/button';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import { InteractiveHalfStar, HalfStarDisplay } from '@/components/HalfStarRating';

interface BundleData {
  id: string; title: string; description: string | null; price: number; image_url: string | null;
  images: string[];
  items: { product_id: string; title: string; image_url: string | null; price: number; category: string | null; stock?: number }[];
}

// GAP-417: Avaliação do bundle
async function getBundleRating(bundleId: string): Promise<{ avg: number; count: number }> {
  const { data } = await supabase
    .from('bundle_ratings' as any)
    .select('rating')
    .eq('bundle_id', bundleId);
  if (!data || data.length === 0) return { avg: 0, count: 0 };
  const avg = data.reduce((s, r: any) => s + r.rating, 0) / data.length;
  return { avg, count: data.length };
}

// GAP-415: Recomendações baseadas no bundle
async function getBundleRecommendations(bundleItems: string[]): Promise<any[]> {
  // Buscar jogos da mesma categoria dos itens do bundle
  const { data: items } = await supabase
    .from('produtos')
    .select('category')
    .in('id', bundleItems);
  
  const categories = new Set((items || []).map((i: any) => i.category).filter(Boolean));
  if (categories.size === 0) return [];
  
  const { data } = await supabase
    .from('produtos')
    .select('id, title, image_url, price, discount, category')
    .in('category', [...categories])
    .not('id', 'in', `(${bundleItems.join(',')})`)
    .eq('is_active', true)
    .limit(4)
    .order('rating', { ascending: false });
  return data || [];
}

export default function BundleDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [bundle, setBundle] = useState<BundleData | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const cart = useCart();
  const { submitting, guard } = useSubmitGuard();
  // GAP-417: Avaliação do bundle
  const [bundleRating, setBundleRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [userRating, setUserRating] = useState<number>(0);
  // GAP-413: Estoques
  const [stockIssues, setStockIssues] = useState<string[]>([]);
  // GAP-415: Recomendações
  const [recommendations, setRecommendations] = useState<any[]>([]);
  // GAP-416: Compartilhamento
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: b } = await supabase
        .from('bundles' as any)
        .select('id, title, description, price, image_url, images')
        .eq('id', id)
        .maybeSingle();
      if (!b || cancelled) { if (!cancelled) { setBundle(null); setLoading(false); } return; }
      const { data: bis } = await supabase
        .from('bundle_items' as any)
        .select('product_id')
        .eq('bundle_id', id);
      const pids = ((bis as any[]) || []).map(x => x.product_id);
      
      // GAP-413: Buscar estoque dos produtos
      const { data: prods } = pids.length
        ? await supabase.from('produtos').select('id, title, image_url, price, category, stock').in('id', pids)
        : { data: [] as any[] };
      
      if (cancelled) return;
      const bd: any = b;
      const items = (prods || []).map((p: any) => ({
        product_id: p.id, title: p.title, image_url: p.image_url,
        price: Number(p.price), category: p.category, stock: p.stock,
      }));
      
      // GAP-413: Verificar estoque
      const outOfStock = items.filter(item => item.stock <= 0).map(item => item.title);
      setStockIssues(outOfStock);
      
      setBundle({
        id: bd.id, title: bd.title, description: bd.description, price: Number(bd.price), image_url: bd.image_url,
        images: (bd.images || []) as string[],
        items,
      });
      setActiveImg(0);
      
      // GAP-417: Buscar avaliação do bundle
      const rating = await getBundleRating(id);
      setBundleRating(rating);
      
      // GAP-415: Buscar recomendações
      const recs = await getBundleRecommendations(pids);
      setRecommendations(recs);
      
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // GAP-417: Avaliar bundle
  const submitRating = async (rating: number) => {
    if (!user) {
      toast.error('Faça login para avaliar');
      return;
    }
    const { error } = await supabase
      .from('bundle_ratings' as any)
      .upsert({
        bundle_id: id,
        user_id: user.id,
        rating,
        updated_at: new Date().toISOString(),
      });
    if (error) {
      toast.error('Erro ao avaliar');
      return;
    }
    setUserRating(rating);
    const newRating = await getBundleRating(id!);
    setBundleRating(newRating);
    toast.success('Avaliação registrada!');
  };

  // GAP-413: Adicionar ao carrinho com validação de estoque
  const addAll = guard(async () => {
    // GAP-413: Verificar estoque novamente
    if (stockIssues.length > 0) {
      toast.error(`Itens sem estoque: ${stockIssues.join(', ')}`);
      return;
    }
    
    for (const it of bundle!.items) {
      cart.addItem({
        id: it.product_id, title: it.title, price: it.price,
        image: it.image_url || '', category: it.category || '', platform: [], rating: 0,
        originalPrice: it.price, discount: 0, description: '',
      } as any, { bundleId: bundle!.id });
    }
    toast.success(`Bundle "${bundle!.title}" adicionado ao carrinho`);
  });

  // GAP-416: Compartilhar bundle
  const handleShare = async () => {
    setSharing(true);
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${bundle?.title} - MIDIAS`,
          text: `Confira o bundle "${bundle?.title}" na MIDIAS! Economize até ${saving}%!`,
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      }
    } catch {
      // Usuário cancelou
    } finally {
      setSharing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!bundle) return (
    <div className="container mx-auto px-4 py-20">
      <EstadoVazio
        icone={PackageSearch}
        titulo="Bundle não encontrado"
        descricao="Ele pode ter sido removido ou o link está incorreto."
        acao={{ label: 'Voltar ao início', to: '/' }}
      />
    </div>
  );

  const total = bundle.items.reduce((s, i) => s + i.price, 0);
  const saving = total > 0 ? Math.round((1 - bundle.price / total) * 100) : 0;
  const savingValue = total - bundle.price;

  const gallery: string[] = [
    ...(bundle.image_url ? [bundle.image_url] : []),
    ...bundle.images.filter(u => u && u !== bundle.image_url),
  ];

  const hasStockIssues = stockIssues.length > 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        {/* GAP-416: Compartilhar */}
        <button
          onClick={handleShare}
          disabled={sharing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          <Share2 className="h-4 w-4" />
          Compartilhar
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="aspect-video bg-secondary rounded-lg overflow-hidden">
            {gallery.length > 0 ? (
              <img src={gallery[activeImg]} alt={bundle.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                {bundle.items.slice(0, 4).map((it, i) => (
                  it.image_url ? <img key={i} src={it.image_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div key={i} className="bg-muted" />
                ))}
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {gallery.slice(0, 12).map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => setActiveImg(i)}
                  className={`relative aspect-video rounded-md overflow-hidden border-2 transition-all ${i === activeImg ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  aria-label={`Imagem ${i + 1}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <span className="inline-flex items-center gap-1 text-xs font-bold bg-gradient-to-r from-primary to-accent text-primary-foreground px-2 py-1 rounded mb-3">
            <Package className="h-3 w-3" /> BUNDLE
          </span>
          <h1 className="text-3xl font-display font-bold mb-2">{bundle.title}</h1>
          {bundle.description && <p className="text-muted-foreground mb-4">{bundle.description}</p>}

          {/* GAP-417: Avaliação do bundle */}
          {bundleRating.count > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <HalfStarDisplay rating={bundleRating.avg} size={16} />
              <span className="text-sm text-foreground">{bundleRating.avg.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({bundleRating.count} avaliações)</span>
            </div>
          )}
          {user && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-1">Avalie este bundle:</p>
              <InteractiveHalfStar value={userRating || 0} onChange={submitRating} />
            </div>
          )}

          {/* GAP-413: Alerta de estoque */}
          {hasStockIssues && (
            <div className="mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                Itens sem estoque: {stockIssues.join(', ')}
              </span>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-4 mb-4">
            <div className="flex items-baseline gap-3 mb-1">
              {saving > 0 && <span className="text-lg text-muted-foreground line-through">{formatCurrency(total)}</span>}
              <span className="text-3xl font-bold text-primary">{formatCurrency(bundle.price)}</span>
              {saving > 0 && <span className="text-sm font-bold bg-success text-success-foreground px-2 py-0.5 rounded">-{saving}%</span>}
            </div>
            {/* GAP-414: Economia real em R$ */}
            {saving > 0 && (
              <p className="text-sm text-success font-medium">
                💰 Economize <strong>{formatCurrency(savingValue)}</strong> comprando o pacote
              </p>
            )}
          </div>
          
          <Button 
            size="lg" 
            className="w-full" 
            disabled={submitting || hasStockIssues} 
            onClick={addAll}
          >
            <ShoppingCart className="h-5 w-5 mr-2" /> 
            {hasStockIssues ? 'Indisponível' : 'Adicionar bundle ao carrinho'}
          </Button>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Jogos incluídos neste bundle</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundle.items.map(it => (
            <Link key={it.product_id} to={`/jogo/${it.product_id}`} className="bg-card border border-border hover:border-primary/60 rounded-lg overflow-hidden flex transition-colors">
              <div className="w-24 h-24 bg-secondary shrink-0">
                {it.image_url && <img src={it.image_url} alt={it.title} className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="p-3 flex-1 min-w-0">
                <h3 className="font-semibold text-sm line-clamp-2">{it.title}</h3>
                <p className="text-xs text-muted-foreground">{it.category || ''}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-primary font-medium">{formatCurrency(it.price)} avulso</p>
                  {it.stock !== undefined && it.stock <= 0 && (
                    <span className="text-[10px] text-destructive">(esgotado)</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* GAP-415: Quem comprou também comprou */}
      {recommendations.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Quem comprou este bundle também comprou</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {recommendations.map((game) => (
              <Link key={game.id} to={`/jogo/${game.id}`} className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/60 transition-colors group">
                <div className="aspect-video bg-secondary">
                  <img src={game.image_url} alt={game.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium line-clamp-1">{game.title}</p>
                  <p className="text-xs text-muted-foreground">{game.category}</p>
                  <p className="text-xs text-price font-semibold">{formatCurrency(game.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}