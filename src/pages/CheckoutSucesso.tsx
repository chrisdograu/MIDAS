import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Package, Home, Sparkles, BookOpen, FileText, Loader2, Truck, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/format';

// GAP-451: Escapar HTML para evitar XSS no título dos produtos
function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

// GAP-451: Gerar nota fiscal simplificada
function generateInvoice(pedido: any) {
  if (!pedido) return;
  
  const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Nota Fiscal - MIDIAS</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #0ea5e9; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .total { font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 16px; margin-top: 16px; }
        .footer { margin-top: 40px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 20px; }
        .badge { background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>MIDIAS - Nota Fiscal</h1>
        <p><strong>Pedido:</strong> #${escapeHtml(pedido.id.slice(0, 12))}</p>
        <p><strong>Data:</strong> ${formatDate(pedido.created_at)}</p>
        <p><strong>Status:</strong> <span class="badge">${pedido.status}</span></p>
      </div>
      <h3>Itens</h3>
      ${(pedido.itens_pedido || []).map((item: any) => `
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
}

// GAP-450: Enviar e-mail de confirmação
async function sendConfirmationEmail(email: string, orderId: string) {
  try {
    const { error } = await supabase.functions.invoke('send-order-confirmation', {
      body: { email, orderId }
    });
    if (error) {
      console.error('Erro ao enviar e-mail de confirmação:', error);
    }
  } catch {
    // Silencioso
  }
}

export default function CheckoutSucesso() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pedido, setPedido] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  
  const orderIdFromState = (location.state as any)?.orderId as string | undefined;

  // GAP-449: Buscar último pedido se não tiver orderId no state
  useEffect(() => {
    async function fetchLastOrder() {
      if (!user) {
        setLoading(false);
        return;
      }

      // Se já temos orderId no state, buscar esse pedido
      if (orderIdFromState) {
        const { data } = await supabase
          .from('pedidos')
          .select('*, itens_pedido(*, produtos(title, image_url))')
          .eq('id', orderIdFromState)
          .eq('user_id', user.id)
          .maybeSingle();
        setPedido(data);
        setLoading(false);
        
        // GAP-450: Enviar e-mail de confirmação
        if (data) {
          sendConfirmationEmail(user.email || '', data.id);
        }
        return;
      }

      // GAP-449: Buscar último pedido do usuário
      const { data } = await supabase
        .from('pedidos')
        .select('*, itens_pedido(*, produtos(title, image_url))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setPedido(data);
      setLoading(false);
      
      if (data) {
        sendConfirmationEmail(user.email || '', data.id);
      }
    }
    
    fetchLastOrder();
  }, [user, orderIdFromState]);

  // GAP-452: Estimar entrega (para itens físicos)
  const hasPhysicalItems = pedido?.itens_pedido?.some((item: any) => item.produtos?.type === 'physical');
  const estimatedDelivery = hasPhysicalItems ? '3 a 7 dias úteis' : 'Instantâneo (digital)';

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground mt-4">Carregando detalhes do pedido...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 max-w-lg text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.6 }}>
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-6">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
          Compra Realizada! <Sparkles className="h-6 w-6 text-accent" />
        </h1>
        <p className="text-muted-foreground mb-2">Seu pedido foi confirmado com sucesso.</p>
        {pedido && (
          <p className="text-sm text-muted-foreground mb-6">
            Pedido: <span className="font-mono text-primary font-semibold">#{pedido.id.slice(0, 8)}</span>
          </p>
        )}

        <div className="bg-card border border-border rounded-xl p-6 mb-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Seus jogos digitais já estão disponíveis na sua biblioteca. Jogos físicos serão enviados em breve.
          </p>
          
          {/* GAP-452: Estimativa de entrega */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground border-t border-border pt-3">
            <Truck className="h-4 w-4 text-primary" />
            <span>Entrega: <strong>{estimatedDelivery}</strong></span>
            {hasPhysicalItems && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Prazo a partir da confirmação
              </span>
            )}
          </div>
        </div>

        {/* GAP-451: Botão de nota fiscal */}
        {pedido && (
          <button
            onClick={() => {
              setDownloading(true);
              generateInvoice(pedido);
              setTimeout(() => setDownloading(false), 1000);
            }}
            disabled={downloading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 mb-4 rounded-lg border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Baixar nota fiscal
          </button>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          <Link to="/biblioteca"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-all">
            <BookOpen className="h-4 w-4" /> Ver Biblioteca
          </Link>
          <Link to="/pedidos"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-foreground font-semibold rounded-lg hover:bg-secondary/80 transition-all">
            <Package className="h-4 w-4" /> Meus Pedidos
          </Link>
          <Link to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-foreground font-semibold rounded-lg hover:bg-secondary/80 transition-all">
            <Home className="h-4 w-4" /> Início
          </Link>
        </div>
      </motion.div>
    </div>
  );
}