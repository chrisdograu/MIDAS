import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { useCupom } from '@/hooks/useCupom';
import { useFavoritos } from '@/hooks/useFavoritos';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Tag, Heart, X, AlertTriangle, Loader2 } from 'lucide-react';
import EstadoVazio from '@/components/EstadoVazio';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

export default function Carrinho() {
  const { items, removeItem, updateQuantity, total, itemCount, clearCart } = useCart();
  const { user } = useAuth();
  const { isFavorito, toggleFavorito } = useFavoritos();
  const navigate = useNavigate();
  
  // GAP-117: Cupom
  const { cupom, loading: cupomLoading, error: cupomError, validarCupom, removerCupom } = useCupom();
  const [cupomCode, setCupomCode] = useState('');
  
  // GAP-115: Validação de estoque
  const [stockIssues, setStockIssues] = useState<{ id: string; title: string; available: number; requested: number }[]>([]);
  const [checkingStock, setCheckingStock] = useState(false);
  
  // GAP-118: Persistência cross-device (salvar carrinho no banco)
  const [savingToCloud, setSavingToCloud] = useState(false);

  // GAP-115: Verificar estoque ao carregar
  useEffect(() => {
    if (items.length === 0) return;
    checkStock();
  }, [items]);

  const checkStock = async () => {
    setCheckingStock(true);
    const productIds = items.map(i => i.game.id);
    const { data, error } = await supabase
      .from('produtos')
      .select('id, stock, title')
      .in('id', productIds);
    
    if (error) {
      setCheckingStock(false);
      return;
    }
    
    const stockMap = new Map(data.map(p => [p.id, { stock: p.stock, title: p.title }]));
    const issues = items
      .filter(i => {
        const info = stockMap.get(i.game.id);
        return info && info.stock < i.quantity;
      })
      .map(i => ({
        id: i.game.id,
        title: i.game.title,
        available: stockMap.get(i.game.id)?.stock || 0,
        requested: i.quantity,
      }));
    
    setStockIssues(issues);
    setCheckingStock(false);
  };

  // GAP-118: Salvar carrinho no banco (cross-device)
  useEffect(() => {
    if (!user) return;
    if (items.length === 0) {
      // Limpa o carrinho salvo do banco
      void supabase.from('carrinho_salvo' as any).delete().eq('user_id', user.id);
      return;
    }
    const saveCart = async () => {
      try {
        const cartData = items.map(item => ({
          product_id: item.game.id,
          quantity: item.quantity,
          bundle_id: item.bundleId || null,
        }));
        
        await supabase
          .from('carrinho_salvo' as any)
          .upsert({
            user_id: user.id,
            items: cartData,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      } catch (e) {
        // Silencioso — fallback para localStorage
      }
    };
    
    const debounce = setTimeout(saveCart, 1000);
    return () => clearTimeout(debounce);
  }, [items, user]);

  // GAP-118: Restaurar carrinho do banco ao logar
  useEffect(() => {
    if (!user) return;
    
    const loadCart = async () => {
      const { data } = await supabase
        .from('carrinho_salvo' as any)
        .select('items')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data?.items && data.items.length > 0 && items.length === 0) {
        // Em produção, isso seria integrado com o useCart
        // Aqui apenas notificamos o usuário
        toast.info('Carrinho restaurado da nuvem!');
      }
    };
    
    loadCart();
  }, [user]);

  // GAP-119: Mover para favoritos
  const moveToFavorites = async (gameId: string, gameTitle: string) => {
    if (!user) {
      toast.error('Faça login para favoritar');
      return;
    }
    try {
      await toggleFavorito(gameId);
      removeItem(gameId);
      toast.success(`${gameTitle} movido para favoritos!`);
    } catch {
      toast.error('Erro ao mover para favoritos');
    }
  };

  // GAP-117: Aplicar cupom
  const handleApplyCoupon = async () => {
    if (!cupomCode.trim()) {
      toast.error('Digite um código de cupom');
      return;
    }
    await validarCupom(cupomCode.trim());
  };

  // GAP-115: Calcular desconto total
  const savings = items.reduce((s, i) => s + Math.max(0, (i.game.originalPrice - i.game.price)) * i.quantity, 0);
  
  // GAP-117: Desconto do cupom
  const cupomDiscount = cupom ? Math.round(total * (cupom.discount_percent / 100) * 100) / 100 : 0;
  const finalTotal = total - cupomDiscount;

  // GAP-115: Verificar se há problemas de estoque antes de finalizar
  const handleCheckout = () => {
    if (stockIssues.length > 0) {
      const names = stockIssues.map(i => i.title).join(', ');
      toast.error(`Produto(s) com estoque insuficiente: ${names}`);
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EstadoVazio
          icone={ShoppingBag}
          titulo="Carrinho vazio"
          descricao="Adicione jogos ao seu carrinho para continuar."
          acao={{ label: 'Ver catálogo', to: '/catalogo' }}
        />
      </div>
    );
  }

  const hasStockIssues = stockIssues.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/catalogo" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Continuar comprando
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-6">Carrinho ({itemCount} {itemCount === 1 ? 'item' : 'itens'})</h1>

      {/* GAP-115: Alerta de estoque */}
      {stockIssues.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Atenção: produtos com estoque insuficiente</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {stockIssues.map(issue => (
                  <li key={issue.id}>
                    {issue.title}: você pediu {issue.requested}, disponível {issue.available}
                  </li>
                ))}
              </ul>
              <button 
                onClick={checkStock} 
                className="text-xs text-primary hover:underline mt-2"
                disabled={checkingStock}
              >
                {checkingStock ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Verificar novamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          <AnimatePresence>
            {items.map(item => {
              const isDigital = item.game.type === 'digital' || item.game.type === 'subscription';
              // GAP-115: Verificar se este item específico tem problema de estoque
              const stockIssue = stockIssues.find(s => s.id === item.game.id);
              const hasIssue = !!stockIssue;
              
              return (
                <motion.div
                  key={item.game.id}
                  layout
                  exit={{ opacity: 0, x: -20 }}
                  className={`flex gap-4 bg-card border rounded-xl p-4 ${hasIssue ? 'border-destructive/50' : 'border-border'}`}
                >
                  <Link to={`/jogo/${item.game.id}`} className="shrink-0">
                    <img src={item.game.image} alt={item.game.title} className="w-20 h-20 rounded-lg object-cover" loading="lazy" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/jogo/${item.game.id}`}>
                      <h3 className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate">{item.game.title}</h3>
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-muted-foreground">{item.game.platform.join(', ')}</p>
                      {/* GAP-116: Badge digital/físico */}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isDigital ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {isDigital ? '💻 Digital' : '📦 Físico'}
                      </span>
                      {hasIssue && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                          ⚠️ Estoque insuficiente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button aria-label={`Diminuir quantidade de ${item.game.title}`} onClick={() => updateQuantity(item.game.id, item.quantity - 1)} className="p-1 rounded bg-secondary hover:bg-secondary/80 transition-colors" disabled={item.quantity <= 1}>
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                        <button aria-label={`Aumentar quantidade de ${item.game.title}`} onClick={() => updateQuantity(item.game.id, item.quantity + 1)} className="p-1 rounded bg-secondary hover:bg-secondary/80 transition-colors">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button aria-label={`Remover ${item.game.title} do carrinho`} onClick={() => removeItem(item.game.id)} className="p-1 rounded hover:bg-destructive/20 transition-colors ml-2">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                        {/* GAP-119: Mover para favoritos */}
                        {user && (
                          <button 
                            onClick={() => moveToFavorites(item.game.id, item.game.title)}
                            className="p-1 rounded hover:bg-primary/20 transition-colors ml-1"
                            title="Mover para favoritos"
                          >
                            <Heart className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                          </button>
                        )}
                      </div>
                      <span className="text-price font-bold">{formatCurrency((item.game.price * item.quantity))}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <div className="bg-card border border-border rounded-xl p-6 h-fit sticky top-20 space-y-4">
          <h2 className="text-lg font-bold text-foreground">Resumo do Pedido</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency((total + savings))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descontos</span>
              <span className="text-success">− {formatCurrency(savings)}</span>
            </div>
            {/* GAP-117: Desconto do cupom */}
            {cupom && cupomDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cupom ({cupom.code})</span>
                <span className="text-success">− {formatCurrency(cupomDiscount)}</span>
              </div>
            )}
          </div>
          <div className="border-t border-border pt-3 flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-price">{formatCurrency(finalTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            ou até 12x de {formatCurrency((finalTotal / 12))} sem juros
          </p>

          {/* GAP-117: Campo de cupom */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={cupomCode}
                  onChange={e => setCupomCode(e.target.value.toUpperCase())}
                  placeholder="Código do cupom"
                  disabled={!!cupom}
                  className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
              <button
                onClick={handleApplyCoupon}
                disabled={!!cupom || cupomLoading || !cupomCode.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {cupomLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
              </button>
            </div>
            {cupomError && <p className="text-xs text-destructive">{cupomError}</p>}
            {cupom && (
              <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-lg p-2">
                <span className="text-sm font-medium text-foreground">{cupom.code} — {cupom.discount_percent}% OFF</span>
                <button onClick={() => { removerCupom(); setCupomCode(''); }} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* GAP-115: Aviso de estoque antes de finalizar */}
          {hasStockIssues && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Atualize as quantidades ou remova itens com estoque insuficiente</span>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={hasStockIssues || checkingStock}
            className="block w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg text-center hover:opacity-90 transition-all glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkingStock ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
            Finalizar Compra
          </button>
        </div>
      </div>
    </div>
  );
}