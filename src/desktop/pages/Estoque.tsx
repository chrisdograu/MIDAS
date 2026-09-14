import { useState, useEffect, useMemo } from 'react';
import { 
  Warehouse, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Search, 
  AlertTriangle, Plus, Loader2, TrendingUp, Download, Filter, 
  Calendar, ChevronLeft, ChevronRight, Bell, History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate, formatDateShort, formatDateTime } from '@/lib/format';
import { adminLog, exportCsv } from '../lib/adminLog';

type Produto = Tables<'produtos'>;
type Mov = Tables<'movimentacoes_estoque'>;

const movTypeColors: Record<string, string> = { 
  entrada: 'bg-success/20 text-success', 
  saida: 'bg-destructive/20 text-destructive', 
  ajuste: 'bg-warning/20 text-warning' 
};
const movTypeIcons: Record<string, typeof ArrowDownToLine> = { 
  entrada: ArrowDownToLine, 
  saida: ArrowUpFromLine, 
  ajuste: RefreshCw 
};

export default function Estoque() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movs, setMovs] = useState<(Mov & { product_name: string; employee_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [chartDays, setChartDays] = useState(30);
  const [lowStockAlerts, setLowStockAlerts] = useState<Produto[]>([]);
  const { toast } = useToast();

  const [fType, setFType] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [fProduct, setFProduct] = useState('');
  const [fQty, setFQty] = useState('');
  const [fNotes, setFNotes] = useState('');
  const PAGE_SIZE = 30;

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: prods }, { data: rawMovs }] = await Promise.all([
      supabase.from('produtos').select('*').order('title'),
      supabase.from('movimentacoes_estoque').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    setProdutos(prods || []);

    // GAP-D124: Identificar produtos com estoque baixo
    const alerts = (prods || []).filter(p => p.stock <= p.stock_alert_threshold);
    setLowStockAlerts(alerts);

    // Resolve product names
    const prodMap = new Map<string, string>((prods || []).map(p => [p.id, p.title]));
    // Resolve employee names
    const empIds = [...new Set((rawMovs || []).map(m => m.employee_id).filter(Boolean))] as string[];
    const { data: profiles } = empIds.length > 0 ? await supabase.from('profiles').select('id, display_name').in('id', empIds) : { data: [] };
    const empMap = new Map<string, string>((profiles || []).map(p => [p.id, p.display_name || 'Funcionário'] as [string, string]));

    setMovs((rawMovs || []).map(m => ({
      ...m, 
      product_name: prodMap.get(m.product_id) || 'Produto', 
      employee_name: (m.employee_id ? (empMap.get(m.employee_id) || '—') : '—') as string,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // GAP-D125: Filtros
  const filteredMovs = useMemo(() => {
    let result = movs;
    
    if (filterType !== 'all') {
      result = result.filter(m => m.type === filterType);
    }
    
    if (filterProduct !== 'all') {
      result = result.filter(m => m.product_id === filterProduct);
    }
    
    if (filterDate !== 'all') {
      const days = filterDate === '7d' ? 7 : filterDate === '30d' ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter(m => new Date(m.created_at) >= cutoff);
    }
    
    return result;
  }, [movs, filterType, filterProduct, filterDate]);

  // GAP-D124: Notificar estoque baixo
  const notifyLowStock = async (produto: Produto) => {
    await supabase.from('notifications').insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      type: 'low_stock',
      title: `⚠️ Estoque baixo: ${produto.title}`,
      body: `O produto "${produto.title}" está com apenas ${produto.stock} unidade(s) em estoque. Mínimo: ${produto.stock_alert_threshold}`,
      reference_type: 'produto',
      reference_id: produto.id,
    });
  };

  const handleCreateMov = async () => {
    if (!fProduct || !fQty) { toast({ title: 'Preencha produto e quantidade', variant: 'destructive' }); return; }
    const prod = produtos.find(p => p.id === fProduct);
    if (!prod) { toast({ title: 'Produto não encontrado', variant: 'destructive' }); return; }

    const qty = Number(fQty);
    if (!Number.isFinite(qty) || qty <= 0) { toast({ title: 'Quantidade inválida', description: 'Informe um número maior que zero.', variant: 'destructive' }); return; }
    const before = prod.stock;
    if (fType === 'saida' && qty > before) {
      toast({ title: 'Estoque insuficiente para esta saída.', description: `"${prod.title}" tem apenas ${before} unidade(s) em estoque.`, variant: 'destructive' });
      return;
    }
    let after = before;
    if (fType === 'entrada') after = before + qty;
    else if (fType === 'saida') after = before - qty;
    else after = qty;

    const label = fType === 'entrada' ? 'Entrada' : fType === 'saida' ? 'Saída' : 'Ajuste';
    const ok = window.confirm(
      `${label} de ${qty} unidade(s) em "${prod.title}".\n\nEstoque: ${before} → ${after}.\n\nA movimentação fica registrada no histórico. Confirmar?`
    );
    if (!ok) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: mov, error: eMov } = await supabase.from('movimentacoes_estoque').insert({
      product_id: fProduct, type: fType as any, quantity: qty,
      quantity_before: before, quantity_after: after,
      employee_id: user?.id || null, notes: fNotes || null,
    }).select('id').single();
    
    if (eMov) {
      setSaving(false);
      toast({ title: 'Erro ao registrar movimentação', description: eMov.message, variant: 'destructive' });
      return;
    }
    
    const { error: eStock } = await supabase.from('produtos').update({ stock: after }).eq('id', fProduct);
    if (eStock) {
      if (mov?.id) await supabase.from('movimentacoes_estoque').delete().eq('id', mov.id);
      setSaving(false);
      toast({ title: 'Erro ao atualizar estoque', description: `${eStock.message} — a movimentação foi desfeita.`, variant: 'destructive' });
      return;
    }

    // GAP-D127: adminLog
    await adminLog({
      action: `stock_${fType}`,
      entity: 'produtos',
      entity_id: fProduct,
      reason: fNotes?.trim() || `${label} de ${qty} unidade(s) em "${prod.title}"`,
      payload: { 
        produto: prod.title, 
        tipo: fType, 
        quantidade: qty, 
        antes: before, 
        depois: after, 
        movimentacao_id: mov?.id ?? null 
      },
    });

    // GAP-D124: Verificar se o produto entrou em alerta após movimentação
    if (after <= prod.stock_alert_threshold) {
      await notifyLowStock({ ...prod, stock: after });
      toast.warning(`⚠️ "${prod.title}" está com estoque baixo (${after} un.)`);
    }

    toast({ title: 'Movimentação registrada!' });
    setSaving(false);
    setDialogOpen(false);
    setFProduct('');
    setFQty('');
    setFNotes('');
    setFType('entrada');
    fetchAll();
  };

  // GAP-D126: Exportar movimentações
  const exportMovements = () => {
    setExporting(true);
    const data = filteredMovs.map(m => ({
      Tipo: m.type,
      Produto: m.product_name,
      Quantidade: m.quantity,
      'Antes': m.quantity_before,
      'Depois': m.quantity_after,
      Funcionario: m.employee_name,
      Observacao: m.notes || '',
      Data: formatDateTime(m.created_at),
    }));
    exportCsv('movimentacoes_estoque.csv', data);
    setExporting(false);
    toast({ title: 'Movimentações exportadas com sucesso' });
  };

  // GAP-D124: Produtos com estoque baixo - página de alertas
  const [alertPage, setAlertPage] = useState(0);
  const alertPageSize = 10;
  const alertProducts = useMemo(() => {
    return produtos.filter(p => p.stock <= p.stock_alert_threshold);
  }, [produtos]);

  const chartData = useMemo(() => {
    const days: { date: string; label: string; entrada: number; saida: number }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: iso, label: formatDateShort(d), entrada: 0, saida: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.date, i]));
    movs.forEach(m => {
      const k = m.created_at.slice(0, 10);
      const i = idx.get(k); if (i === undefined) return;
      if (m.type === 'entrada') days[i].entrada += m.quantity;
      else if (m.type === 'saida') days[i].saida += m.quantity;
    });
    return days;
  }, [movs, chartDays]);

  const totalPages = Math.ceil(filteredMovs.length / PAGE_SIZE);
  const paginatedMovs = filteredMovs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-primary" /> Estoque
          </h1>
          <p className="text-muted-foreground text-sm">
            {produtos.length} produtos · {movs.length} movimentações registradas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportMovements} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Nova Movimentação
          </Button>
        </div>
      </div>

      {/* GAP-D124: Alertas de estoque baixo */}
      {lowStockAlerts.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning">
                  {lowStockAlerts.length} produto(s) com estoque baixo ou zerado
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lowStockAlerts.slice(0, 5).map(p => (
                    <Badge key={p.id} variant="outline" className="text-[10px] bg-warning/10 border-warning/30">
                      {p.title}: {p.stock} un.
                    </Badge>
                  ))}
                  {lowStockAlerts.length > 5 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{lowStockAlerts.length - 5} mais
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                // Rolagem para a aba de estoque atual com filtro
                const tab = document.querySelector('[value="atual"]') as HTMLElement;
                if (tab) tab.click();
              }}>
                Ver todos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="movimentacoes">
        <TabsList>
          <TabsTrigger value="movimentacoes">
            <History className="h-4 w-4 mr-1" /> Movimentações ({movs.length})
          </TabsTrigger>
          <TabsTrigger value="atual">
            <Warehouse className="h-4 w-4 mr-1" /> Estoque Atual ({produtos.length})
          </TabsTrigger>
          <TabsTrigger value="grafico">
            <TrendingUp className="h-4 w-4 mr-1" /> Gráfico
          </TabsTrigger>
        </TabsList>

        {/* Movimentações com filtros */}
        <TabsContent value="movimentacoes" className="mt-4 space-y-4">
          {/* GAP-D125: Filtros */}
          <Card className="border-border/50">
            <CardContent className="py-3 px-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-9" 
                    placeholder="Buscar por produto..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-36">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterProduct} onValueChange={setFilterProduct}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {produtos.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterDate} onValueChange={setFilterDate}>
                  <SelectTrigger className="w-36">
                    <Calendar className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => {
                  setFilterType('all');
                  setFilterProduct('all');
                  setFilterDate('all');
                  setSearch('');
                }}>
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-center">Antes</TableHead>
                    <TableHead className="text-center">Depois</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMovs.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="p-0">
                      <EstadoVazio titulo="Nenhuma movimentação" />
                    </TableCell></TableRow>
                  ) : paginatedMovs.map(m => {
                    const Icon = movTypeIcons[m.type] || RefreshCw;
                    return (
                      <TableRow key={m.id} className="border-border hover:bg-muted/30">
                        <TableCell>
                          <Badge className={movTypeColors[m.type]}>
                            <Icon className="h-3 w-3 mr-1" />
                            {m.type.charAt(0).toUpperCase() + m.type.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{m.product_name}</TableCell>
                        <TableCell className="text-center text-sm font-mono">
                          {m.type === 'saida' ? `-${m.quantity}` : m.type === 'ajuste' ? m.quantity : `+${m.quantity}`}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{m.quantity_before}</TableCell>
                        <TableCell className="text-center text-sm font-medium">{m.quantity_after}</TableCell>
                        <TableCell className="text-sm">{m.employee_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.notes || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Paginação */}
          {filteredMovs.length > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {filteredMovs.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filteredMovs.length)} de ${filteredMovs.length}` : '0 resultados'}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs flex items-center px-2">
                  {page + 1} / {totalPages || 1}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Estoque Atual */}
        <TabsContent value="atual" className="mt-4">
          <Card className="border-border/50">
            <CardContent className="py-3 px-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar produto..." 
                  className="pl-9" 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
            </CardContent>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead className="text-center">Estoque</TableHead>
                    <TableHead className="text-center">Mínimo</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtos.filter(p => 
                    p.title.toLowerCase().includes(search.toLowerCase())
                  ).map(p => {
                    const isLow = p.stock <= p.stock_alert_threshold;
                    const isZero = p.stock === 0;
                    return (
                      <TableRow key={p.id} className="border-border hover:bg-muted/30">
                        <TableCell>
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{p.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{(p.platform || []).join(', ')}</TableCell>
                        <TableCell className="text-center text-sm font-mono font-bold">
                          {p.stock}
                          {isZero && <Badge className="ml-1 bg-destructive/15 text-destructive text-[10px]">Zerado</Badge>}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{p.stock_alert_threshold}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={
                            isZero ? 'bg-destructive/20 text-destructive border-destructive/30' :
                            isLow ? 'bg-warning/20 text-warning border-warning/30' :
                            'bg-success/20 text-success border-success/30'
                          }>
                            {isZero ? 'Sem Estoque' : isLow ? 'Baixo' : 'Normal'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gráfico */}
        <TabsContent value="grafico" className="mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Movimentações
              </CardTitle>
              <div className="flex gap-1">
                {[7, 30, 90].map(d => (
                  <Button 
                    key={d} 
                    size="sm" 
                    variant={chartDays === d ? 'default' : 'outline'}
                    className="h-7 text-xs px-2" 
                    onClick={() => setChartDays(d)}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entrada" name="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saida" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de nova movimentação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Movimentação</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={fType} onValueChange={v => setFType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="ajuste">Ajuste (Inventário)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={fProduct} onValueChange={setFProduct}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {produtos.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} (Est: {p.stock})
                      {p.stock <= p.stock_alert_threshold && ' ⚠️'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" placeholder="0" value={fQty} onChange={e => setFQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea 
                placeholder="Motivo da movimentação" 
                rows={2} 
                value={fNotes} 
                onChange={e => setFNotes(e.target.value)} 
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button className="bg-primary text-primary-foreground" onClick={handleCreateMov} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}