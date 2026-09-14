import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { orderStatusTone } from '@/lib/semanticTone';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useState } from 'react';
import { toast } from 'sonner';
import { Printer, Share2, Package, MapPin, Clock, RefreshCw, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// GAP-OD01: Status de entrega
interface TrackingEvent {
  status: string;
  description: string;
  timestamp: string;
  location?: string;
}

interface OrderDetailModalProps {
  pedido: any | null;
  onClose: () => void;
  /** GAP-OD02: Permitir solicitar reembolso */
  allowRefund?: boolean;
  /** GAP-OD03: Função de impressão */
  onPrint?: () => void;
}

export default function OrderDetailModal({ 
  pedido, 
  onClose, 
  allowRefund = true,
  onPrint,
}: OrderDetailModalProps) {
  const { user } = useAuth();
  const [refunding, setRefunding] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!pedido) return null;
  const s = orderStatusTone(pedido.status);
  const isDelivered = pedido.status === 'entregue' || pedido.status === 'finalizado';
  const isRefundable = allowRefund && 
    (pedido.status === 'entregue' || pedido.status === 'finalizado') && 
    !pedido.refunded;

  // GAP-OD01: Tracking events mock
  const trackingEvents: TrackingEvent[] = pedido.tracking_events || [
    { status: 'Pedido confirmado', description: 'Seu pedido foi confirmado', timestamp: pedido.created_at },
    { status: 'Em preparação', description: 'Seu pedido está sendo preparado', timestamp: new Date(new Date(pedido.created_at).getTime() + 60 * 60 * 1000).toISOString() },
    ...(isDelivered ? [
      { status: 'Enviado', description: 'Seu pedido foi enviado', timestamp: new Date().toISOString() },
      { status: 'Entregue', description: 'Seu pedido foi entregue', timestamp: new Date().toISOString() },
    ] : []),
  ];

  // GAP-OD02: Solicitar reembolso
  const handleRefund = async () => {
    if (!user) return;
    setRefunding(true);
    
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ status: 'reembolsado', refunded_at: new Date().toISOString() })
        .eq('id', pedido.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Registrar no histórico
      await supabase
        .from('order_history')
        .insert({
          order_id: pedido.id,
          status: 'reembolsado',
          note: 'Reembolso solicitado pelo cliente'
        });

      toast.success('Reembolso solicitado com sucesso!');
      onClose();
    } catch {
      toast.error('Erro ao solicitar reembolso');
    } finally {
      setRefunding(false);
    }
  };

  // GAP-OD03: Imprimir
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  };

  // GAP-OD04: Compartilhar
  const handleShare = async () => {
    setSharing(true);
    try {
      const url = `${window.location.origin}/pedidos/${pedido.id}`;
      const text = `Pedido #${pedido.id.slice(0, 8)} - ${pedido.itens_pedido?.length || 0} itens - Total: ${formatCurrency(Number(pedido.total))}`;
      
      if (navigator.share) {
        await navigator.share({ title: 'Meu Pedido MIDIAS', text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success('Link do pedido copiado!');
      }
    } catch {
      // Usuário cancelou ou erro
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={!!pedido} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Pedido #{pedido.id.slice(0, 8)}</span>
            <div className="flex items-center gap-1">
              {/* GAP-OD03: Botão de imprimir */}
              <button
                onClick={handlePrint}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Imprimir pedido"
              >
                <Printer className="h-4 w-4 text-muted-foreground" />
              </button>
              {/* GAP-OD04: Botão de compartilhar */}
              <button
                onClick={handleShare}
                disabled={sharing}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Compartilhar pedido"
              >
                <Share2 className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status e data */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{formatDateTime(pedido.created_at)}</span>
            <Badge variant="outline" className={s.badgeClass}>{s.label}</Badge>
          </div>

          {/* GAP-OD01: Tracking timeline */}
          <div className="bg-secondary/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Rastreamento</span>
            </div>
            <div className="space-y-2">
              {trackingEvents.map((event, index) => {
                const isLast = index === trackingEvents.length - 1;
                const isActive = event.status === 'Entregue' || isLast;
                return (
                  <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full mt-1",
                        isActive ? "bg-primary" : "bg-muted-foreground/30"
                      )} />
                      {!isLast && <div className="w-px h-4 bg-border" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-xs font-medium text-foreground">{event.status}</p>
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {formatDateTime(event.timestamp)}
                        {event.location && ` · ${event.location}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Itens */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Itens</p>
            {pedido.itens_pedido?.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                <img 
                  src={item.produtos?.image_url || '/placeholder.svg'} 
                  alt="" 
                  className="w-10 h-10 rounded object-cover"
                  loading="lazy" 
                />
                <span className="flex-1 text-foreground truncate">{item.produtos?.title || 'Produto'}</span>
                <span className="text-muted-foreground">x{item.quantity}</span>
                <span className="text-price font-semibold">{formatCurrency(Number(item.price_at_purchase))}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Totais */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(Number(pedido.subtotal || 0))}</span>
            </div>
            {Number(pedido.discount_amount) > 0 && (
              <div className="flex justify-between text-success">
                <span>Desconto {pedido.coupon_code ? `(${pedido.coupon_code})` : ''}</span>
                <span>- {formatCurrency(Number(pedido.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-foreground pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-price">{formatCurrency(Number(pedido.total))}</span>
            </div>
            <div className="text-xs text-muted-foreground pt-2">
              Pagamento: {pedido.payment_method === 'pix' ? 'Pix' : pedido.payment_method === 'credit' ? `Cartão ${pedido.installments}x` : 'Boleto'}
            </div>
          </div>

          {/* GAP-OD02: Botão de reembolso */}
          {isRefundable && (
            <>
              <Separator />
              <div className="flex justify-end">
                <button
                  onClick={handleRefund}
                  disabled={refunding}
                  className="px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {refunding ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    'Solicitar Reembolso'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}