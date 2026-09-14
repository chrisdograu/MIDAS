import { useState, useEffect } from 'react';
import { Users, Search, Eye, ShoppingBag, Loader2, Clock, Ban, UserCheck, AlertTriangle, History, Calendar, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import EstadoVazio from '@/components/EstadoVazio';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/format';
import { adminLog } from '../lib/adminLog';
import { toast } from 'sonner';

interface Cliente {
  id: string; display_name: string | null; phone: string | null; cpf: string | null;
  contact_email: string | null; created_at: string; total_compras: number; total_gasto: number;
  last_login: string | null; banned_until: string | null; is_banned: boolean;
}

interface PedidoDetalhado {
  id: string; total: number; status: string; created_at: string; items_count: number;
}

export default function Clientes() {
  const [search, setSearch] = useState('');
  const [purchaseFilter, setPurchaseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [pedidosCliente, setPedidosCliente] = useState<PedidoDetalhado[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [banOpen, setBanOpen] = useState<Cliente | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('7');
  const [banning, setBanning] = useState(false);

  // GAP-D76: Último acesso
  const fetchLastLogin = async (userId: string) => {
    const { data } = await supabase
      .from('sessions')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    return data?.[0]?.created_at || null;
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'user');
      const userIds = roles?.map(r => r.user_id) || [];

      if (userIds.length === 0) { setClientes([]); setLoading(false); return; }

      const { data: profiles } = await (supabase as any).rpc('list_profiles_admin', { _ids: userIds });
      
      const { data: pedidos } = await supabase.from('pedidos').select('user_id, total, status').in('status', ['confirmed', 'processing', 'shipped', 'delivered']);
      
      const orderMap = new Map<string, { count: number; total: number }>();
      pedidos?.forEach(p => {
        if (!p.user_id) return;
        const cur = orderMap.get(p.user_id) || { count: 0, total: 0 };
        cur.count++; cur.total += Number(p.total);
        orderMap.set(p.user_id, cur);
      });

      // GAP-D76: Buscar último acesso e status de banimento
      const clientesWithData = await Promise.all((profiles || []).map(async (p: any) => {
        const lastLogin = await fetchLastLogin(p.id);
        const isBanned = p.banned_until ? new Date(p.banned_until) > new Date() : false;
        return {
          id: p.id, display_name: p.display_name, phone: p.phone, cpf: p.cpf,
          contact_email: p.contact_email, created_at: p.created_at,
          total_compras: orderMap.get(p.id)?.count || 0,
          total_gasto: orderMap.get(p.id)?.total || 0,
          last_login: lastLogin,
          banned_until: p.banned_until,
          is_banned: isBanned,
        };
      }));

      setClientes(clientesWithData);
      setLoading(false);
    };
    fetch();
  }, []);

  // GAP-D74: Carregar histórico de compras do cliente
  const loadPedidosCliente = async (clienteId: string) => {
    setLoadingPedidos(true);
    const { data } = await supabase
      .from('pedidos')
      .select('id, total, status, created_at, itens:pedido_itens(count)')
      .eq('user_id', clienteId)
      .order('created_at', { ascending: false });
    
    setPedidosCliente((data || []).map((p: any) => ({
      id: p.id,
      total: Number(p.total),
      status: p.status,
      created_at: p.created_at,
      items_count: p.itens?.[0]?.count || 0,
    })));
    setLoadingPedidos(false);
  };

  // GAP-D77: Banir cliente
  const banCliente = async () => {
    if (!banOpen) return;
    if (!banReason.trim()) { toast.error('Motivo do banimento é obrigatório'); return; }
    
    setBanning(true);
    const days = Number(banDuration);
    const bannedUntil = new Date();
    bannedUntil.setDate(bannedUntil.getDate() + days);
    
    const { error } = await supabase
      .from('profiles')
      .update({ banned_until: bannedUntil.toISOString() })
      .eq('id', banOpen.id);
    
    setBanning(false);
    if (error) { toast.error('Erro ao banir: ' + error.message); return; }
    
    await adminLog({
      action: 'banir_cliente',
      entity: 'profiles',
      entity_id: banOpen.id,
      reason: banReason,
      payload: { duracao: days, ate: bannedUntil.toISOString(), usuario: banOpen.display_name },
    });
    
    toast.success(`Cliente banido por ${days} dias`);
    setBanOpen(null);
    setBanReason('');
    // Recarregar lista
    const { data } = await supabase.from('profiles').select('id, banned_until').eq('id', banOpen.id);
    if (data?.length) {
      const isBanned = data[0].banned_until ? new Date(data[0].banned_until) > new Date() : false;
      setClientes(prev => prev.map(c => 
        c.id === banOpen.id ? { ...c, banned_until: data[0].banned_until, is_banned: isBanned } : c
      ));
    }
  };

  // GAP-D77: Desbanir cliente
  const desbanirCliente = async (cliente: Cliente) => {
    if (!confirm(`Desbanir ${cliente.display_name}?`)) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ banned_until: null })
      .eq('id', cliente.id);
    
    if (error) { toast.error('Erro ao desbanir: ' + error.message); return; }
    
    await adminLog({
      action: 'desbanir_cliente',
      entity: 'profiles',
      entity_id: cliente.id,
      reason: 'Desbanimento administrativo',
      payload: { usuario: cliente.display_name },
    });
    
    toast.success('Cliente desbanido');
    setClientes(prev => prev.map(c => 
      c.id === cliente.id ? { ...c, banned_until: null, is_banned: false } : c
    ));
  };

  // GAP-D75: Calcular tempo de plataforma
  const getMemberSince = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days} dias`;
    if (days < 365) return `${Math.floor(days / 30)} meses`;
    return `${Math.floor(days / 365)} anos`;
  };

  // GAP-D76: Status de atividade
  const getActivityStatus = (lastLogin: string | null) => {
    if (!lastLogin) return { label: 'Nunca acessou', color: 'bg-muted text-muted-foreground' };
    const diff = Date.now() - new Date(lastLogin).getTime();
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) return { label: 'Hoje', color: 'bg-success/15 text-success' };
    if (hours < 168) return { label: 'Esta semana', color: 'bg-warning/15 text-warning' };
    return { label: 'Há mais de 1 semana', color: 'bg-muted text-muted-foreground' };
  };

  const filtered = clientes.filter(c => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query ||
      (c.display_name || '').toLowerCase().includes(query) ||
      (c.contact_email || '').toLowerCase().includes(query) ||
      (c.phone || '').toLowerCase().includes(query) ||
      (c.cpf || '').includes(query);
    const matchesPurchases =
      purchaseFilter === 'all' ||
      (purchaseFilter === 'with_orders' && c.total_compras > 0) ||
      (purchaseFilter === 'without_orders' && c.total_compras === 0);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !c.is_banned) ||
      (statusFilter === 'banned' && c.is_banned);
    return matchesSearch && matchesPurchases && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Clientes</h1>
        <p className="text-muted-foreground text-sm">{clientes.length} clientes cadastrados</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[260px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, email, telefone ou CPF..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={purchaseFilter} onValueChange={setPurchaseFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                <SelectItem value="with_orders">Com compras</SelectItem>
                <SelectItem value="without_orders">Sem compras</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="banned">Banidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Compras</TableHead>
                  <TableHead className="text-right">Total Gasto</TableHead>
                  <TableHead className="text-center">Membro</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="p-0"><EstadoVazio titulo="Nenhum cliente encontrado" /></TableCell></TableRow>
                ) : filtered.map(c => {
                  const activity = getActivityStatus(c.last_login);
                  return (
                    <TableRow key={c.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-accent/10 text-accent text-xs font-bold">
                              {(c.display_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium text-sm">{c.display_name || 'Sem nome'}</span>
                            {c.is_banned && <Badge className="ml-1 bg-destructive/15 text-destructive text-[10px]">🚫 Banido</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.contact_email || '—'}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{c.total_compras}</Badge></TableCell>
                      <TableCell className="text-right text-sm font-medium text-primary">{formatCurrency(c.total_gasto)}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getMemberSince(c.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={activity.color}>
                          <Activity className="h-3 w-3 mr-0.5" /> {activity.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Visualizar" onClick={() => { 
                          setSelectedCliente(c); 
                          setDetailOpen(true); 
                          loadPedidosCliente(c.id); 
                        }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) setSelectedCliente(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Detalhes do Cliente
            </DialogTitle>
          </DialogHeader>
          {selectedCliente && (
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-4 py-2">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-accent/10 text-accent text-lg font-bold">
                      {(selectedCliente.display_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {selectedCliente.display_name || 'Sem nome'}
                      {selectedCliente.is_banned && <Badge className="bg-destructive/15 text-destructive">🚫 Banido</Badge>}
                    </h3>
                    <p className="text-sm text-muted-foreground">{selectedCliente.contact_email || '—'}</p>
                  </div>
                  {!selectedCliente.is_banned ? (
                    <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setBanOpen(selectedCliente)}>
                      <Ban className="h-4 w-4 mr-1" /> Banir
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="ml-auto" onClick={() => desbanirCliente(selectedCliente)}>
                      <UserCheck className="h-4 w-4 mr-1" /> Desbanir
                    </Button>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">CPF</p>
                    <p className="font-mono text-sm">{selectedCliente.cpf || '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm">{selectedCliente.phone || '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Membro desde</p>
                    <p className="text-sm">{formatDate(selectedCliente.created_at)}</p>
                    <p className="text-xs text-muted-foreground">({getMemberSince(selectedCliente.created_at)})</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Último acesso</p>
                    <p className="text-sm">{selectedCliente.last_login ? formatDate(selectedCliente.last_login) : 'Nunca'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Total de Compras</p>
                    <p className="text-lg font-bold text-primary flex items-center gap-1"><ShoppingBag className="h-4 w-4" />{selectedCliente.total_compras}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Total Gasto</p>
                    <p className="text-lg font-bold text-accent">{formatCurrency(selectedCliente.total_gasto)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                    <p className="text-lg font-bold">{selectedCliente.total_compras > 0 ? formatCurrency(selectedCliente.total_gasto / selectedCliente.total_compras) : '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge className={getActivityStatus(selectedCliente.last_login).color}>
                      {getActivityStatus(selectedCliente.last_login).label}
                    </Badge>
                  </div>
                </div>

                {/* GAP-D74: Histórico de compras */}
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <History className="h-4 w-4 text-primary" /> Histórico de Compras
                  </h4>
                  {loadingPedidos ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : pedidosCliente.length === 0 ? (
                    <EstadoVazio titulo="Nenhuma compra" descricao="Este cliente ainda não realizou compras." />
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {pedidosCliente.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-muted/30">
                          <div>
                            <p className="text-sm font-medium">Pedido #{p.id.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-primary">{formatCurrency(p.total)}</p>
                            <p className="text-xs text-muted-foreground">{p.items_count} itens · {p.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ban Dialog */}
      <AlertDialog open={!!banOpen} onOpenChange={(o) => { if (!o) { setBanOpen(null); setBanReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Banir Cliente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a banir <b>{banOpen?.display_name}</b>. O cliente não poderá acessar a plataforma durante o período definido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Duração do banimento</Label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia</SelectItem>
                  <SelectItem value="3">3 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="365">1 ano</SelectItem>
                  <SelectItem value="permanent">Permanente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo <span className="text-destructive">*</span></Label>
              <Textarea 
                value={banReason} 
                onChange={e => setBanReason(e.target.value)} 
                placeholder="Descreva o motivo do banimento (mín. 3 caracteres)" 
                rows={3} 
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={banCliente} disabled={banning || !banReason.trim()} className="bg-destructive text-destructive-foreground">
              {banning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar Banimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}