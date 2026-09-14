import { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Search, Eye, RefreshCw, Loader2, Undo2, Download, ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useToast } from '@/hooks/use-toast';
import { statusLabels, statusColors } from '../mockData';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { adminLog } from '../lib/adminLog';

const allStatuses = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
const ITEMS_PER_PAGE = 20;

interface Pedido {
  id: string; user_id: string | null; total: number; status: string; payment_method: string | null;
  created_at: string; items_count: number; cliente_name: string;
}

interface PedidoItem {
  id: string; product_id: string; quantity: number; price_at_purchase: number;
  product_title: string;
}

export default function PedidosOnline() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailPedido, setDetailPedido] = useState<Pedido | null>(null);
  const [detailItems, setDetailItems] = useState<PedidoItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundValor, setRefundValor] = useState('');
  const [refundMotivo, setRefundMotivo] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refunds, setRefunds] = useState<Record<string, { valor: number; motivo: string; processado_em: string }>>({});
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const fetchPedidos = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase.from('pedidos').select('*', { count: 'exact' }).order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      // GAP-D201: Filtro por período
      if (dateFilter === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        query = query.gte('created_at', today);
      } else if (dateFilter === 'week') {
        const week = new Date();
        week.setDate(week.getDate() - 7);
        query = query.gte('created_at', week.toISOString());
      } else if (dateFilter === 'month') {
        const month = new Date();
        month.setDate(month.getDate() - 30);
        query = query.gte('created_at', month.toISOString());
      }

      const { data: orders, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;

      if (!orders) {
        if (reset) setLoading(false);
        else setLoadingMore(false);
        return;
      }

      const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))] as string[];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
        : { data: [] };
      const profileMap = new Map<string, string>((profiles || []).map(p => [p.id, p.display_name || 'Cliente'] as [string, string]));

      const { data: items } = await supabase.from('itens_pedido').select('order_id');
      const itemCount = new Map<string, number>();
      items?.forEach(i => itemCount.set(i.order_id, (itemCount.get(i.order_id) || 0) + 1));

      const processed = orders.map(o => ({
        id: o.id, user_id: o.user_id, total: Number(o.total), status: o.status,
        payment_method: o.payment_method, created_at: o.created_at,
        items_count: itemCount.get(o.id) || 0,
        cliente_name: (o.user_id ? (profileMap.get(o.user_id) || 'Cliente') : 'Anônimo') as string,
      }));

      const { data: reembolsos } = await supabase.from('reembolsos').select('pedido_id, valor, motivo, processado_em').order('processado_em', { ascending: false });
      const rmap: Record<string, { valor: number; motivo: string; processado_em: string }> = {};
      (reembolsos || []).forEach(r => { if (!rmap[r.pedido_id]) rmap[r.pedido_id] = { valor: Number(r.valor), motivo: r.motivo, processado_em: r.processado_em }; });
      setRefunds(rmap);

      if (reset) {
        setPedidos(processed);
        setHasMore((orders || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setPedidos(prev => [...prev, ...processed]);
        setHasMore((orders || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast({ title: 'Erro ao carregar pedidos', variant: 'destructive' });
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { fetchPedidos(true); }, [statusFilter, dateFilter]);

  // GAP-D207: Realtime
  useRealtimeRefresh(['pedidos'], () => fetchPedidos(true), 'admin-pedidos');

  const openDetail = async (p: Pedido) => {
    setDetailPedido(p); setNewStatus(p.status); setDetailItems([]); setLoadingItems(true);
    const { data: items } = await supabase.from('itens_pedido').select('id, product_id, quantity, price_at_purchase').eq('order_id', p.id);
    if (items && items.length > 0) {
      const prodIds = [...new Set(items.map(i => i.product_id))];
      const { data: prods } = await supabase.from('produtos').select('id, title').in('id', prodIds);
      const prodMap = new Map<string, string>((prods || []).map(pr => [pr.id, pr.title]));
      setDetailItems(items.map(i => ({ ...i, product_title: prodMap.get(i.product_id) || 'Produto' })));
    }
    setLoadingItems(false);
  };

  // GAP-D203: adminLog e GAP-D204: Notificação
  const updateStatus = async () => {
    if (!detailPedido || !newStatus || newStatus === detailPedido.status) return;
    
    const before = detailPedido.status;
    const { error: err } = await supabase.from('pedidos').update({ status: newStatus as any }).eq('id', detailPedido.id);
    if (err) { toast({ title: 'Erro na operação', description: err.message, variant: 'destructive' }); return; }

    await adminLog({
      action: 'update_order_status',
      entity: 'pedidos',
      entity_id: detailPedido.id,
      reason: `Status alterado de ${statusLabels[before] || before} para ${statusLabels[newStatus] || newStatus}`,
      payload: { before: { status: before }, after: { status: newStatus } }
    });

    await supabase.from('notifications').insert({
      user_id: detailPedido.user_id,
      type: 'sale',
      title: 'Status do seu pedido atualizado',
      body: `Seu pedido #${detailPedido.id.slice(0, 8)} está agora como "${statusLabels[newStatus] || newStatus}".`,
      reference_type: 'pedido',
      reference_id: detailPedido.id,
    });

    toast({ title: 'Status atualizado e registrado!' });
    setDetailPedido(null);
    fetchPedidos(true);
  };

  const openRefund = () => {
    if (!detailPedido) return;
    setRefundValor(String(detailPedido.total));
    setRefundMotivo('');
    setRefundOpen(true);
  };

  // GAP-D203: adminLog e GAP-D204: Notificação
  const confirmRefund = async () => {
    if (!detailPedido) return;
    const valor = Number(refundValor.replace(',', '.'));
    if (!valor || valor <= 0 || valor > detailPedido.total) {
      toast({ title: 'Valor inválido', description: `Informe um valor entre 0,01 e ${formatCurrency(detailPedido.total)}.`, variant: 'destructive' });
      return;
    }
    if (refundMotivo.trim().length < 5) {
      toast({ title: 'Motivo obrigatório', description: 'Descreva o motivo do reembolso (mínimo 5 caracteres).', variant: 'destructive' });
      return;
    }
    setRefunding(true);
    const { error } = await supabase.rpc('admin_refund_order', {
      _pedido_id: detailPedido.id, _valor: valor, _motivo: refundMotivo.trim(),
    });
    setRefunding(false);
    if (error) { toast({ title: 'Erro ao reembolsar', description: error.message, variant: 'destructive' }); return; }

    await adminLog({
      action: 'refund_order',
      entity: 'pedidos',
      entity_id: detailPedido.id,
      reason: `Reembolso de ${formatCurrency(valor)} registrado. Motivo: ${refundMotivo.trim()}`,
      payload: { valor, motivo: refundMotivo.trim() }
    });

    await supabase.from('notifications').insert({
      user_id: detailPedido.user_id,
      type: 'sale',
      title: 'Reembolso processado',
      body: `O reembolso de ${formatCurrency(valor)} para o pedido #${detailPedido.id.slice(0, 8)} foi processado.`,
      reference_type: 'pedido',
      reference_id: detailPedido.id,
    });

    toast({ title: 'Reembolso registrado e usuário notificado.' });
    setRefundOpen(false); setDetailPedido(null); fetchPedidos(true);
  };

  // GAP-D202: Exportar CSV
  const exportCSV = () => {
    setExporting(true);
    const data = filtered.map(p => ({
      ID: p.id.slice(0, 8),
      Cliente: p.cliente_name,
      Total: p.total,
      Status: statusLabels[p.status] || p.status,
      Pagamento: p.payment_method || '',
      Data: formatDate(p.created_at),
      Itens: p.items_count,
    }));

    const headers = Object.keys(data[0] || {});
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = (row as any)[h] || '';
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(','))
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast({ title: 'CSV exportado com sucesso' });
  };

  const filtered = pedidos.filter(p => {
    const matchSearch = p.id.toLowerCase().includes(search.toLowerCase()) || 
                        p.cliente_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // GAP-D206: Contagem por status
  const statusCounts = allStatuses.slice(1).map(s => ({ 
    status: s, 
    count: pedidos.filter(p => p.status === s).length 
  }));

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(0, (page + 1) * ITEMS_PER_PAGE);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6 text-primary" /> Pedidos Online</h1>
          <p className="text-muted-foreground text-sm">{pedidos.length} pedidos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* GAP-D206: Cards de status */}
      <div className="grid grid-cols-3 lg:grid-cols-7 gap-3">
        {statusCounts.map(({ status, count }) => (
          <Card 
            key={status} 
            className={`border-border/50 cursor-pointer hover:border-primary/30 transition-colors ${statusFilter === status ? 'border-primary/50 bg-primary/5' : ''}`}
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
          >
            <CardContent className="py-3 px-4 text-center">
              <p className="text-2xl font-bold">{count}</p>
              <Badge className={`${statusColors[status]} mt-1 text-[10px]`}>{statusLabels[status]}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por ID ou cliente..." 
              className="pl-9" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {allStatuses.map(s => (
                <SelectItem key={s} value={s}>
                  {s === 'all' ? 'Todos os Status' : statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* GAP-D201: Filtro por período */}
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-36">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setDateFilter('all'); setSearch(''); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="p-0"><EstadoVazio titulo="Nenhum pedido encontrado" /></TableCell></TableRow>
                ) : filtered.map(p => (
                  <TableRow key={p.id} className="border-border hover:bg-muted/30">
                    <TableCell className="font-mono text-sm text-primary font-semibold">{p.id.slice(0, 8)}...</TableCell>
                    <TableCell className="text-sm">{p.cliente_name}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline">{p.items_count}</Badge></TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatCurrency(p.total)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.payment_method || '—'}</TableCell>
                    <TableCell className="text-center"><Badge className={statusColors[p.status]}>{statusLabels[p.status] || p.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Visualizar" onClick={() => openDetail(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GAP-D200: Paginação */}
      {filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Mostrando {Math.min((page + 1) * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs flex items-center px-2">{page + 1} / {Math.ceil(filtered.length / ITEMS_PER_PAGE)}</span>
            <Button variant="outline" size="sm" disabled={!hasMore || (page + 1) * ITEMS_PER_PAGE >= filtered.length} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de detalhes */}
      <Dialog open={!!detailPedido} onOpenChange={o => { if (!o) setDetailPedido(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Pedido {detailPedido?.id.slice(0, 8)}...</DialogTitle></DialogHeader>
          {detailPedido && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Cliente</p><p className="text-sm font-medium">{detailPedido.cliente_name}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Total</p><p className="text-sm font-bold text-primary">{formatCurrency(detailPedido.total)}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Pagamento</p><p className="text-sm">{detailPedido.payment_method || '—'}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Status</p><Badge className={statusColors[detailPedido.status]}>{statusLabels[detailPedido.status]}</Badge></div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Itens do Pedido</p>
                {loadingItems ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                ) : detailItems.length === 0 ? (
                  <EstadoVazio titulo="Nenhum item encontrado" />
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {detailItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                        <span className="flex-1 truncate">{item.product_title}</span>
                        <span className="text-muted-foreground mx-2">x{item.quantity}</span>
                        <span className="font-semibold text-primary">{formatCurrency(Number(item.price_at_purchase))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Atualizar Status</p>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(s =>
                      <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button className="w-full bg-primary text-primary-foreground" size="sm" onClick={updateStatus} disabled={detailPedido.status === 'refunded'}>
                  <RefreshCw className="h-4 w-4 mr-2" />Atualizar
                </Button>

                {detailPedido.status === 'refunded' ? (
                  <div className="p-3 rounded-lg bg-accent/10 border border-accent/40 text-sm">
                    <p className="font-medium text-accent">Pedido reembolsado</p>
                    {refunds[detailPedido.id] && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(refunds[detailPedido.id].valor)} devolvidos em {formatDate(refunds[detailPedido.id].processado_em)} — {refunds[detailPedido.id].motivo}
                      </p>
                    )}
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={openRefund} disabled={detailPedido.status === 'cancelled'}>
                    <Undo2 className="h-4 w-4 mr-2" />Reembolsar pedido
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de reembolso */}
      <AlertDialog open={refundOpen} onOpenChange={o => { setRefundOpen(o); if (!o) { setRefundValor(''); setRefundMotivo(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar reembolso</AlertDialogTitle>
            <AlertDialogDescription>
              O reembolso é registrado para rastreamento administrativo. A devolução do dinheiro no meio de pagamento continua sendo feita fora do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Valor a devolver (máx. {detailPedido ? formatCurrency(detailPedido.total) : '—'})</Label>
              <Input type="number" step="0.01" min="0.01" value={refundValor} onChange={e => setRefundValor(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Motivo (obrigatório)</Label>
              <Textarea rows={3} placeholder="Ex: cliente não recebeu a chave do jogo..." value={refundMotivo} onChange={e => setRefundMotivo(e.target.value)} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refunding}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={refunding} onClick={e => { e.preventDefault(); confirmRefund(); }}>
              {refunding ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Registrando…</> : 'Confirmar reembolso'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}