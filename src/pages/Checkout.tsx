import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { useCupom } from '@/hooks/useCupom';
import { usePedidos } from '@/hooks/usePedidos';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { useFavoritos } from '@/hooks/useFavoritos';
import { useAuth } from '@/hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, CreditCard, QrCode, Building, ShieldCheck, Lock, Tag, X, 
  Heart, Save, MapPin, Mail, AlertTriangle, CheckCircle2, Smartphone 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import RequiresConnection from '@/components/RequiresConnection';
import EstadoVazio from '@/components/EstadoVazio';
import { ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { dbWrite } from '@/lib/dbWrite';
import SelectSimples from '@/components/SelectSimples';

type PaymentMethod = 'credit' | 'pix' | 'boleto';

// GAP-120, GAP-442: Funções de validação de cartão
function validateCardNumber(number: string): boolean {
  // Luhn algorithm
  const digits = number.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function validateExpiry(expiry: string): boolean {
  const [month, year] = expiry.split('/').map(Number);
  if (!month || !year || month < 1 || month > 12) return false;
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

function validateCVV(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv);
}

// GAP-122: Componente de endereço
function AddressForm({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <div className="space-y-3 mt-3 p-3 border border-border rounded-lg">
      <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" /> Endereço de Entrega
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="CEP"
          value={value.cep || ''}
          onChange={(e) => onChange({ ...value, cep: e.target.value })}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
        />
        <input
          placeholder="Número"
          value={value.number || ''}
          onChange={(e) => onChange({ ...value, number: e.target.value })}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
        />
      </div>
      <input
        placeholder="Endereço"
        value={value.street || ''}
        onChange={(e) => onChange({ ...value, street: e.target.value })}
        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Cidade"
          value={value.city || ''}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
        />
        <input
          placeholder="Estado"
          value={value.state || ''}
          onChange={(e) => onChange({ ...value, state: e.target.value })}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
        />
      </div>
    </div>
  );
}

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { cupom, loading: cupomLoading, error: cupomError, validarCupom, removerCupom, redeemCupom } = useCupom();
  const { criarPedido } = usePedidos();
  const { toggleFavorito } = useFavoritos();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { submitting: processing, guard } = useSubmitGuard();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [installments, setInstallments] = useState(1);
  const [cupomCode, setCupomCode] = useState('');

  // GAP-120, GAP-442: Estado dos campos de cartão
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  // GAP-121, GAP-443: Salvar cartão
  const [saveCard, setSaveCard] = useState(false);

  // GAP-122: Endereço de entrega (apenas para itens físicos)
  const [address, setAddress] = useState({ cep: '', number: '', street: '', city: '', state: '' });
  const [showAddress, setShowAddress] = useState(false);

  // GAP-124: Confirmar e-mail
  const [confirmEmail, setConfirmEmail] = useState(false);

  // GAP-123: Checkout com 1 clique (se cartão salvo)
  const [oneClick, setOneClick] = useState(false);

  // GAP-116: Verificar se há itens físicos
  const hasPhysicalItems = items.some(i => i.game.type === 'physical');

  const installmentOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const pixDiscount = paymentMethod === 'pix' ? Math.round(total * 0.05 * 100) / 100 : 0;
  const cupomDiscount = cupom ? Math.round(total * (cupom.discount_percent / 100) * 100) / 100 : 0;
  const totalDiscount = pixDiscount + cupomDiscount;
  const finalTotal = Math.max(0, total - totalDiscount);

  // GAP-119: Mover item para favoritos
  const moveToFavorites = async (item: any) => {
    if (!user) {
      toast.error('Faça login para favoritar');
      return;
    }
    try {
      await toggleFavorito(item.game.id);
      toast.success(`${item.game.title} movido para favoritos!`);
    } catch {
      toast.error('Erro ao mover para favoritos');
    }
  };

  // GAP-115: Validar estoque antes da compra
  const validateStock = async (): Promise<boolean> => {
    const productIds = items.map(i => i.game.id);
    const { data, error } = await supabase
      .from('produtos')
      .select('id, stock, title')
      .in('id', productIds);
    if (error) {
      toast.error('Erro ao validar estoque');
      return false;
    }
    const stockMap = new Map(data.map(p => [p.id, p.stock]));
    const outOfStock = items.filter(i => {
      const available = stockMap.get(i.game.id) || 0;
      return available < i.quantity;
    });
    if (outOfStock.length > 0) {
      const names = outOfStock.map(i => i.game.title).join(', ');
      toast.error(`Produto(s) sem estoque suficiente: ${names}`);
      return false;
    }
    return true;
  };

  const handleApplyCoupon = async () => {
    if (!cupomCode.trim()) return;
    await validarCupom(cupomCode.trim());
  };

  // GAP-120, GAP-442: Validar cartão
  const validateCard = (): boolean => {
    const errors: Record<string, string> = {};
    if (!cardNumber || !validateCardNumber(cardNumber)) {
      errors.cardNumber = 'Número de cartão inválido';
    }
    if (!cardExpiry || !validateExpiry(cardExpiry)) {
      errors.cardExpiry = 'Data de validade inválida';
    }
    if (!cardCVV || !validateCVV(cardCVV)) {
      errors.cardCVV = 'CVV inválido';
    }
    if (!cardName || cardName.length < 3) {
      errors.cardName = 'Nome no cartão é obrigatório';
    }
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePurchase = guard(async () => {
    // GAP-115: Validar estoque
    const stockOk = await validateStock();
    if (!stockOk) return;

    // GAP-120, GAP-442: Validar cartão se for crédito
    if (paymentMethod === 'credit' && !validateCard()) {
      toast.error('Preencha os dados do cartão corretamente');
      return;
    }

    // GAP-124: Confirmar e-mail
    if (!confirmEmail) {
      toast.error('Confirme seu e-mail antes de finalizar');
      return;
    }

    let pedido: any = null;
    try {
      // GAP-121, GAP-443: Salvar cartão
      if (paymentMethod === 'credit' && saveCard && user) {
        // Nota: Em produção, isso seria salvo em um serviço de tokenização
        // Aqui apenas simulamos
        localStorage.setItem('saved_card', JSON.stringify({
          last4: cardNumber.slice(-4),
          expiry: cardExpiry,
          name: cardName,
        }));
      }

      pedido = await criarPedido.mutateAsync({
        items,
        subtotal: total,
        discountAmount: totalDiscount,
        total: finalTotal,
        paymentMethod,
        installments: paymentMethod === 'credit' ? installments : 1,
        couponCode: cupom?.code || null,
        // GAP-122: Endereço de entrega
        address: hasPhysicalItems ? address : null,
      });

      if (cupom && pedido?.id) {
        const couponId = await redeemCupom(pedido.id);
        if (!couponId) {
          await dbWrite(supabase.from('pedidos').update({ status: 'cancelled' as any }).eq('id', pedido.id));
          toast.error('Cupom não pôde ser aplicado. Pedido cancelado.');
          return;
        }
      }

      clearCart();
      toast.success('Compra realizada com sucesso!');
      navigate('/checkout/sucesso', { state: { orderId: pedido?.id } });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao processar pedido. Tente novamente.');
    }
  });

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <EstadoVazio
          icone={ShoppingBag}
          titulo="Seu carrinho está vazio"
          descricao="Adicione jogos antes de finalizar a compra."
          acao={{ label: 'Ir para o catálogo', to: '/catalogo' }}
        />
      </div>
    );
  }

  const groupedItems = items.reduce<Array<{ key: string; bundleId: string | null; items: typeof items }>>((groups, item) => {
    const key = item.bundleId ? `bundle-${item.bundleId}` : `game-${item.game.id}`;
    const group = groups.find(entry => entry.key === key);
    if (group) group.items.push(item);
    else groups.push({ key, bundleId: item.bundleId ?? null, items: [item] });
    return groups;
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link to="/carrinho" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar ao carrinho
      </Link>
      <h1 className="text-2xl font-bold text-foreground mb-6">Finalizar Compra</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {/* Items */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-foreground">Itens ({groupedItems.length})</h2>
            {groupedItems.map(group => {
              const item = group.items[0];
              if (group.bundleId) {
                const price = item.bundlePrice ?? group.items.reduce((sum, entry) => sum + entry.game.price, 0);
                return <div key={group.key} className="flex items-center gap-3 text-sm"><div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center overflow-hidden">{item.bundleImage ? <img src={item.bundleImage} alt={item.bundleTitle || 'Bundle'} className="w-full h-full object-cover" /> : <ShoppingBag className="h-4 w-4 text-primary" />}</div><div className="flex-1 min-w-0"><p className="font-semibold truncate">{item.bundleTitle || 'Bundle de jogos'}</p><p className="text-xs text-muted-foreground truncate">{group.items.map(entry => entry.game.title).join(' • ')}</p></div><span className="text-muted-foreground">x{item.quantity}</span><span className="text-price font-semibold">{formatCurrency(price * item.quantity)}</span></div>;
              }
              // GAP-116: Badge para item digital/físico
              const isDigital = item.game.type === 'digital' || item.game.type === 'subscription';
              return (
                <div key={group.key} className="flex items-center gap-3 text-sm">
                  <img src={item.game.image} alt={item.game.title} className="w-10 h-10 rounded object-cover" loading="lazy" />
                  <span className="flex-1 text-foreground truncate">{item.game.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {isDigital ? '💻 Digital' : '📦 Físico'}
                  </span>
                  <span className="text-muted-foreground">x{item.quantity}</span>
                  <span className="text-price font-semibold">{formatCurrency((item.game.price * item.quantity))}</span>
                  {/* GAP-119: Mover para favoritos */}
                  {user && (
                    <button
                      onClick={() => moveToFavorites(item)}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Mover para favoritos"
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cupom */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2"><Tag className="h-4 w-4" /> Cupom de Desconto</h2>
            {cupom ? (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg p-3">
                <Tag className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground font-medium">{cupom.code} — {cupom.discount_percent}% de desconto</span>
                <button onClick={removerCupom} className="ml-auto"><X className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={cupomCode} onChange={e => setCupomCode(e.target.value)} placeholder="Digite o código"
                  className="flex-1 px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <button onClick={handleApplyCoupon} disabled={cupomLoading}
                  className="px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
                  Aplicar
                </button>
              </div>
            )}
            {cupomError && <p className="text-xs text-destructive">{cupomError}</p>}
          </div>

          {/* GAP-122: Endereço de entrega (apenas para itens físicos) */}
          {hasPhysicalItems && (
            <div className="bg-card border border-border rounded-xl p-4">
              <button
                onClick={() => setShowAddress(!showAddress)}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <MapPin className="h-4 w-4" />
                {showAddress ? 'Ocultar endereço de entrega' : 'Adicionar endereço de entrega'}
              </button>
              {showAddress && <AddressForm value={address} onChange={setAddress} />}
            </div>
          )}

          {/* GAP-124: Confirmar e-mail */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Confirmo que meu e-mail está correto para receber os jogos</span>
            </label>
          </div>

          {/* Payment method */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h2 className="font-semibold text-foreground">Método de Pagamento</h2>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'credit' as const, icon: CreditCard, label: 'Cartão' },
                { id: 'pix' as const, icon: QrCode, label: 'Pix' },
                { id: 'boleto' as const, icon: Building, label: 'Boleto' },
              ]).map(method => (
                <button key={method.id} onClick={() => setPaymentMethod(method.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm font-medium transition-all ${paymentMethod === method.id ? 'border-primary bg-primary/10 text-primary glow-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                  <method.icon className="h-5 w-5" />
                  {method.label}
                </button>
              ))}
            </div>

            {paymentMethod === 'credit' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {/* GAP-120, GAP-442: Validação de cartão em tempo real */}
                <div>
                  <input
                    placeholder="Número do cartão"
                    value={cardNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      const formatted = val.replace(/(.{4})/g, '$1 ').trim();
                      setCardNumber(formatted);
                      if (cardErrors.cardNumber) setCardErrors({ ...cardErrors, cardNumber: '' });
                    }}
                    className={`w-full px-4 py-2.5 bg-secondary border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${cardErrors.cardNumber ? 'border-destructive' : 'border-border'}`}
                  />
                  {cardErrors.cardNumber && <p className="text-xs text-destructive mt-1">{cardErrors.cardNumber}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length >= 2) val = val.slice(0, 2) + '/' + val.slice(2, 4);
                        setCardExpiry(val);
                        if (cardErrors.cardExpiry) setCardErrors({ ...cardErrors, cardExpiry: '' });
                      }}
                      className={`w-full px-4 py-2.5 bg-secondary border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${cardErrors.cardExpiry ? 'border-destructive' : 'border-border'}`}
                    />
                    {cardErrors.cardExpiry && <p className="text-xs text-destructive mt-1">{cardErrors.cardExpiry}</p>}
                  </div>
                  <div>
                    <input
                      placeholder="CVV"
                      value={cardCVV}
                      onChange={(e) => {
                        setCardCVV(e.target.value.replace(/\D/g, ''));
                        if (cardErrors.cardCVV) setCardErrors({ ...cardErrors, cardCVV: '' });
                      }}
                      className={`w-full px-4 py-2.5 bg-secondary border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${cardErrors.cardCVV ? 'border-destructive' : 'border-border'}`}
                    />
                    {cardErrors.cardCVV && <p className="text-xs text-destructive mt-1">{cardErrors.cardCVV}</p>}
                  </div>
                </div>
                <div>
                  <input
                    placeholder="Nome no cartão"
                    value={cardName}
                    onChange={(e) => {
                      setCardName(e.target.value);
                      if (cardErrors.cardName) setCardErrors({ ...cardErrors, cardName: '' });
                    }}
                    className={`w-full px-4 py-2.5 bg-secondary border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${cardErrors.cardName ? 'border-destructive' : 'border-border'}`}
                  />
                  {cardErrors.cardName && <p className="text-xs text-destructive mt-1">{cardErrors.cardName}</p>}
                </div>

                {/* GAP-121, GAP-443: Salvar cartão */}
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveCard}
                    onChange={(e) => setSaveCard(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <Save className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Salvar cartão para próximas compras</span>
                </label>

                {/* GAP-123: Checkout com 1 clique */}
                {saveCard && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={oneClick}
                      onChange={(e) => setOneClick(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Checkout com 1 clique (próximas compras)</span>
                  </label>
                )}

                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Parcelas</label>
                  <SelectSimples
                    value={String(installments)}
                    onChange={(v) => setInstallments(Number(v))}
                    label="Número de parcelas"
                    className="w-full"
                    options={installmentOptions.map(n => ({
                      value: String(n),
                      label: `${n}x de ${formatCurrency(finalTotal / n)}${n <= 6 ? ' sem juros' : ' com juros'}`,
                    }))}
                  />
                </div>
              </motion.div>
            )}

            {paymentMethod === 'pix' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4 space-y-3">
                <div className="w-40 h-40 mx-auto bg-secondary rounded-xl flex items-center justify-center border border-border">
                  <QrCode className="h-24 w-24 text-muted-foreground" />
                </div>
                <p className="text-sm text-success font-medium">5% de desconto no Pix!</p>
                <p className="text-sm text-muted-foreground">Escaneie o QR Code ou copie o código para pagar</p>
              </motion.div>
            )}

            {paymentMethod === 'boleto' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <p className="text-sm text-muted-foreground">O boleto será gerado após confirmar a compra. Prazo de pagamento: 3 dias úteis.</p>
                <input placeholder="CPF" className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </motion.div>
            )}
          </div>
        </div>

        {/* Order total */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 sticky top-20">
            <h2 className="text-lg font-bold text-foreground">Total do Pedido</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(total)}</span></div>
              {pixDiscount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Desconto Pix (5%)</span><span className="text-success">-{formatCurrency(pixDiscount)}</span></div>}
              {cupomDiscount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Cupom ({cupom?.discount_percent}%)</span><span className="text-success">-{formatCurrency(cupomDiscount)}</span></div>}
            </div>
            <div className="border-t border-border pt-3 flex justify-between text-xl font-bold">
              <span>Total</span>
              <span className="text-price">{formatCurrency(finalTotal)}</span>
            </div>
            {paymentMethod === 'credit' && installments > 1 && <p className="text-xs text-muted-foreground">{installments}x de {formatCurrency((finalTotal / installments))}</p>}

            <RequiresConnection message="A finalização da compra exige internet — nada é enviado offline para não gerar pedido duplicado.">
              <button onClick={handlePurchase} disabled={processing}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all glow-primary disabled:opacity-50">
                {processing ? <span className="animate-pulse">Processando...</span> : <><Lock className="h-4 w-4" /> Confirmar Compra</>}
              </button>
            </RequiresConnection>

            {/* GAP-124: Confirmar e-mail (reforço visual) */}
            {!confirmEmail && (
              <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 p-2 rounded-lg">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Confirme seu e-mail para receber os jogos</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Pagamento 100% seguro
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}