import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePedidos } from '@/hooks/usePedidos';
import { useCart } from '@/hooks/useCart';
import { supabase } from '@/integrations/supabase/client';
import { Package, Loader2, ArrowLeft, Eye, RotateCcw, FileText, Truck, CheckCircle2, Clock, AlertTriangle, X, Loader2 as Spinner } from 'lucide-react';
import OrderDetailModal from '@/components/OrderDetailModal';
import EstadoVazio from '@/components/EstadoVazio';
import BuscaInput from '@/components/BuscaInput';
import { orderStatusTone } from '@/lib/semanticTone';
import { formatCurrency, formatDate } from '@/lib/format';
import SelectSimples from '@/components/SelectSimples';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';

// GAP-554: Interface para rastreio
interface TrackingInfo {
  code: string;
  carrier: string;
  url?: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed';
  events: { date: string; description: string; location?: string }[];
}

// Escapar HTML para evitar XSS no título dos produtos
function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

export default function Pedidos() {
  const { pedidos, isLoading, refetch } = usePedidos();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<any | null>(null);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<string>('todos');
  
  // GAP-549: Estado para modal de reembolso
  const [refundModal, setRefundModal] = useState<{ open: boolean; pedido: any | null; loading: boolean }>({
    open: false,
    pedido: null,
    loading: false,
  });
  const [refundReason, setRefundReason] = useState('');
  
  // GAP-553: Calcular dias desde entrega
  const getDaysSinceDelivery = (deliveredAt: string): number | null => {
    if (!deliveredAt) return null;
    const delivered = new Date(deliveredAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - delivered.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // GAP-551: Comprar novamente
  const handleReorder = async (pedido: any) => {
    if (!pedido.itens_pedido || pedido.itens_pedido.length === 0) {
      toast.error('Este pedido não tem itens para reordenar');
      return;
    }
    
    // Buscar produtos atuais para verificar estoque
    const productIds = pedido.itens_pedido.map((i: any) => i.product_id);
    const { data: produtos } = await supabase
      .from('produtos')
      .select('id, stock, is_active')
      .in('id', productIds);
    
    const stockMap = new Map(produtos?.map(p => [p.id, p]) || []);
    let hasStockIssue = false;
    
    for (const item of pedido.itens_pedido) {
      const produto = stockMap.get(item.product_id);
      if (!produto || !produto.is_active || produto.stock < item.quantity) {
        hasStockIssue = true;
        const title = item.produtos?.title || 'Produto';
        toast.error(`${title} não está disponível na quantidade desejada`);
        break;
      }
    }
    
    if (hasStockIssue) return;
    
    // Adicionar ao carrinho
    let addedCount = 0;
    for (const item of pedido.itens_pedido) {
      const game = {
        id: item.product_id,
        title: item.produtos?.title || 'Produto',
        price: Number(item.price_at_purchase),
        image: item.produtos?.image_url || '',
        // Outros campos necessários
        originalPrice: Number(item.price_at_purchase),
        stock: stockMap.get(item.product_id)?.stock || 0,
        is_active: true,
      };
      for (let i = 0; i < item.quantity; i++) {
        addItem(game as any, { bundleId: item.bundle_id ?? null });
        addedCount++;
      }
    }
    
    toast.success(`${addedCount} item(ns) adicionado(s) ao carrinho!`);
    navigate('/carrinho');
  };

  // GAP-549: Solicitar reembolso
  const handleRefundRequest = async () => {
    if (!refundModal.pedido) return;
    if (!refundReason.trim() || refundReason.length < 10) {
      toast.error('Descreva o motivo do reembolso (mínimo 10 caracteres)');
      return;
    }
    
    setRefundModal(prev => ({ ...prev, loading: true }));
    
    try {
      const ok = await dbWrite(
        supabase
          .from('pedidos')
          .update({ 
            status: 'refunded',
            refund_reason: refundReason,
            refund_requested_at: new Date().toISOString(),
          })
          .eq('id', refundModal.pedido.id)
      );
      
      if (!ok) return;
      
      toast.success('Reembolso solicitado com sucesso!');
      setRefundModal({ open: false, pedido: null, loading: false });
      setRefundReason('');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao solicitar reembolso');
      setRefundModal(prev => ({ ...prev, loading: false }));
    }
  };

  // GAP-552: Baixar nota fiscal (simulada)
  const handleDownloadInvoice = (pedido: any) => {
    // Gerar PDF simples via HTML
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Nota Fiscal - MIDIAS</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { margin: 0; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .total { font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 16px; margin-top: 16px; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
          .badge { background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MIDIAS - Nota Fiscal</h1>
          <p><strong>Pedido:</strong> #${escapeHtml(pedido.id.slice(0, 12))}</p>
          <p><strong>Data:</strong> ${formatDate(pedido.created_at)}</p>
          <p><strong>Status:</strong> <span class="badge">${escapeHtml(pedido.status)}</span></p>
        </div>
        <h3>Itens</h3>
        ${pedido.itens_pedido?.map((item: any) => `
          <div class="row">
            <span>${escapeHtml(item.produtos?.title || 'Produto')} x${item.quantity}</span>
            <span>R$ ${Number(item.price_at_purchase).toFixed(2)}</span>
          </div>
        `).join('')}
        <div class="total">
          <div class="row">
            <span>Total</span>
            <span>R$ ${Number(pedido.total).toFixed(2)}</span>
          </div>
        </div>
        <div class="footer">
          <p>Esta é uma nota fiscal simulada para fins acadêmicos.</p>
          <p>MIDIAS - Jogos digitais com os melhores preços</p>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([invoiceHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nota-fiscal-${pedido.id.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Nota fiscal baixada!');
  };

  const termo = busca.trim().toLowerCase();
  const visiveis = pedidos.filter(p => {
    if (status !== 'todos' && p.status !== status) return false;
    if (!termo) return true;
    if (p.id.toLowerCase().includes(termo)) return true;
    if ((p.coupon_code || '').toLowerCase().includes(termo)) return true;
    return (p.itens_pedido || []).some((i: any) => (i.produtos?.title || '').toLowerCase().includes(termo));
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-bold text-foreground mb-6">Meus pedidos</h1>

      {pedidos.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <BuscaInput
            value={busca}
            onChange={setBusca}
            placeholder="Buscar por jogo, número do pedido ou cupom..."
            className="flex-1"
          />
          <SelectSimples
            value={status}
            onChange={setStatus}
            label="Filtrar por status"
            className="min-w-[11rem]"
            options={[
              { value: 'todos', label: 'Todos os status' },
              { value: 'pending', label: 'Pendente' },
              { value: 'paid', label: 'Pago' },
              { value: 'shipped', label: 'Enviado' },
              { value: 'delivered', label: 'Entregue' },
              { value: 'cancelled', label: 'Cancelado' },
              { value: 'refunded', label: 'Reembolsado' },
            ]}
          />
        </div>
      )}

      {pedidos.length === 0 ? (
        <EstadoVazio
          icone={Package}
          titulo="Nenhum pedido encontrado"
          descricao="Quando você finalizar uma compra, o pedido aparece aqui com status e detalhes."
          acao={{ label: 'Explorar catálogo', to: '/catalogo' }}
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio
          icone={Package}
          titulo="Nenhum pedido corresponde aos filtros"
          descricao="Ajuste a busca ou o status para ver seus pedidos."
        />
      ) : (
        <div className="space-y-4">
          {visiveis.map(pedido => {
            const s = orderStatusTone(pedido.status);
            const isDelivered = pedido.status === 'delivered';
            const deliveredAt = pedido.delivered_at || pedido.updated_at;
            const daysSinceDelivery = isDelivered && deliveredAt ? getDaysSinceDelivery(deliveredAt) : null;
            
            // GAP-553: Texto de dias desde entrega
            let deliveryText = '';
            if (isDelivered && daysSinceDelivery !== null) {
              if (daysSinceDelivery === 0) deliveryText = 'Entregue hoje!';
              else if (daysSinceDelivery === 1) deliveryText = 'Entregue ontem';
              else deliveryText = `Entregue há ${daysSinceDelivery} dias`;
            }
            
            // GAP-550: Verificar se o pedido mudou de status recentemente (últimas 24h)
            const isRecentChange = pedido.updated_at && 
              new Date(pedido.updated_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;

            return (
              <div
                key={pedido.id}
                className="bg-card border border-border rounded-xl p-4 space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Pedido #{pedido.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(pedido.created_at)}</p>
                    {/* GAP-553: Dias desde entrega */}
                    {isDelivered && deliveryText && (
                      <p className="text-xs text-success flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" /> {deliveryText}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* GAP-550: Badge de notificação de mudança de status */}
                    {isRecentChange && pedido.status !== 'pending' && (
                      <span className="relative">
                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-1 rounded ${s.badgeClass}`}>{s.label}</span>
                    <button onClick={() => setSelected(pedido)}>
                      <Eye className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                    </button>
                  </div>
                </div>
                
                {pedido.itens_pedido?.slice(0, 2).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <img src={item.produtos?.image_url || '/placeholder.svg'} alt="" className="w-10 h-10 rounded object-cover" loading="lazy" />
                    <span className="flex-1 text-foreground truncate">{item.produtos?.title || 'Produto'}</span>
                    <span className="text-muted-foreground">x{item.quantity}</span>
                    <span className="text-price font-semibold">{formatCurrency(Number(item.price_at_purchase))}</span>
                  </div>
                ))}
                {(pedido.itens_pedido?.length || 0) > 2 && (
                  <p className="text-xs text-muted-foreground">+ {(pedido.itens_pedido?.length || 0) - 2} item(ns)</p>
                )}
                
                <div className="flex justify-between items-center border-t border-border pt-3">
                  <div className="text-xs text-muted-foreground">
                    {pedido.payment_method === 'pix' ? 'Pix' : pedido.payment_method === 'credit' ? `Cartão ${pedido.installments}x` : 'Boleto'}
                    {pedido.coupon_code && ` • Cupom: ${pedido.coupon_code}`}
                  </div>
                  <span className="font-bold text-price">{formatCurrency(Number(pedido.total))}</span>
                </div>
                
                {/* Ações do pedido */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                  {/* GAP-551: Comprar novamente */}
                  {pedido.status !== 'cancelled' && pedido.status !== 'refunded' && (
                    <button
                      onClick={() => handleReorder(pedido)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-primary/10 border border-border hover:border-primary/40 transition-all"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Comprar novamente
                    </button>
                  )}
                  
                  {/* GAP-552: Baixar nota fiscal */}
                  <button
                    onClick={() => handleDownloadInvoice(pedido)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-primary/10 border border-border hover:border-primary/40 transition-all"
                  >
                    <FileText className="h-3.5 w-3.5" /> Nota Fiscal
                  </button>
                  
                  {/* GAP-549: Solicitar reembolso */}
                  {pedido.status !== 'refunded' && pedido.status !== 'cancelled' && pedido.status !== 'delivered' && (
                    <button
                      onClick={() => setRefundModal({ open: true, pedido, loading: false })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 hover:border-destructive/40 transition-all"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> Solicitar reembolso
                    </button>
                  )}
                  
                  {/* GAP-554: Rastreio (se disponível) */}
                  {(pedido as any).tracking_code && (
                    <a
                      href={(pedido as any).tracking_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-primary/10 border border-border hover:border-primary/40 transition-all"
                    >
                      <Truck className="h-3.5 w-3.5" /> Rastrear pedido
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OrderDetailModal pedido={selected} onClose={() => setSelected(null)} />
      
      {/* GAP-549: Modal de reembolso */}
      {refundModal.open && refundModal.pedido && (
        <div className="fixed inset-0 z-50 bg-overlay/60 flex items-center justify-center p-4" onClick={() => setRefundModal({ open: false, pedido: null, loading: false })}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" /> Solicitar Reembolso
              </h3>
              <button 
                onClick={() => setRefundModal({ open: false, pedido: null, loading: false })}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Pedido #{refundModal.pedido.id.slice(0, 8)} — Total: {formatCurrency(Number(refundModal.pedido.total))}
            </p>
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-1 block">Motivo do reembolso</label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Descreva o motivo do reembolso (mínimo 10 caracteres)..."
                className="w-full p-3 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground mt-1">{refundReason.length}/10 caracteres</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRefundModal({ open: false, pedido: null, loading: false })}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold"
                disabled={refundModal.loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleRefundRequest}
                disabled={refundModal.loading || refundReason.length < 10}
                className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {refundModal.loading ? <Spinner className="h-4 w-4 animate-spin inline" /> : 'Solicitar reembolso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}