import { useState, useEffect, useMemo } from 'react';
import { Bell, Mail, MailOpen, Loader2, Search, ArrowLeft, User, Filter, Download, Eye, CheckCheck, Calendar, Clock, Tag, AlertCircle, CheckCircle2, XCircle, MessageCircle, ShoppingBag, Trophy, Shield, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate, formatDateTime } from '@/lib/format';
import { adminLog } from '../lib/adminLog';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { ChevronRight } from 'lucide-react';

const typeLabels: Record<string, string> = {
  nova_mensagem: '💬 Mensagem',
  proposta_aceita: '✅ Proposta Aceita',
  proposta_recusada: '❌ Proposta Recusada',
  comentario_review: '💬 Comentário',
  certificado_aprovado: '✅ Certificado OK',
  certificado_recusado: '❌ Certificado Recusado',
  certificado_revogado: '⚠️ Certificado Revogado',
  torneio_inicio: '🏆 Torneio Início',
  torneio_resultado: '🏆 Resultado Torneio',
  venda_realizada: '💰 Venda Realizada',
  novo_seguidor: '👤 Novo Seguidor',
  denuncia_atualizada: '⚠️ Denúncia Atualizada',
  sistema_aviso: '🔔 Aviso do Sistema',
};

const typeColors: Record<string, string> = {
  nova_mensagem: 'bg-primary/20 text-primary border-primary/30',
  proposta_aceita: 'bg-success/20 text-success border-success/30',
  proposta_recusada: 'bg-destructive/20 text-destructive border-destructive/30',
  comentario_review: 'bg-accent/20 text-accent border-accent/30',
  certificado_aprovado: 'bg-success/20 text-success border-success/30',
  certificado_recusado: 'bg-destructive/20 text-destructive border-destructive/30',
  certificado_revogado: 'bg-warning/20 text-warning border-warning/30',
  torneio_inicio: 'bg-primary/20 text-primary border-primary/30',
  torneio_resultado: 'bg-warning/20 text-warning border-warning/30',
  venda_realizada: 'bg-success/20 text-success border-success/30',
  novo_seguidor: 'bg-accent/20 text-accent border-accent/30',
  denuncia_atualizada: 'bg-destructive/20 text-destructive border-destructive/30',
  sistema_aviso: 'bg-muted/20 text-muted-foreground border-muted-foreground/30',
};

interface Notif {
  id: string;
  user_id: string;
  user_name: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  payload?: any;
}

const ITEMS_PER_PAGE = 30;

// GAP-D171: Modal de detalhes
function DetailModal({ open, onClose, notif }: { open: boolean; onClose: () => void; notif: Notif | null }) {
  if (!notif) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Detalhes da Notificação
          </DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={typeColors[notif.type] || 'bg-muted text-muted-foreground'}>
                {typeLabels[notif.type] || notif.type}
              </Badge>
              <Badge variant={notif.is_read ? 'secondary' : 'default'}>
                {notif.is_read ? '✓ Lida' : '📬 Não lida'}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div>
            <Label className="text-xs text-muted-foreground">Usuário</Label>
            <p className="text-sm font-medium">{notif.user_name}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Título</Label>
            <p className="text-sm font-semibold">{notif.title}</p>
          </div>
          {notif.body && (
            <div>
              <Label className="text-xs text-muted-foreground">Conteúdo</Label>
              <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-lg border border-border">
                {notif.body}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Criada em</Label>
              <p className="font-mono text-xs">{formatDateTime(notif.created_at)}</p>
            </div>
            {notif.read_at && (
              <div>
                <Label className="text-xs text-muted-foreground">Lida em</Label>
                <p className="font-mono text-xs">{formatDateTime(notif.read_at)}</p>
              </div>
            )}
          </div>
          {notif.reference_type && (
            <div>
              <Label className="text-xs text-muted-foreground">Referência</Label>
              <p className="text-sm font-mono text-xs">
                {notif.reference_type} — {notif.reference_id}
              </p>
            </div>
          )}
          {notif.payload && (
            <div>
              <Label className="text-xs text-muted-foreground">Payload</Label>
              <pre className="text-xs bg-muted/30 p-3 rounded-lg border border-border overflow-x-auto">
                {JSON.stringify(notif.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function NotificacoesAdmin() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailNotif, setDetailNotif] = useState<Notif | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const { toast } = useToast();

  const loadNotifs = async (reset: boolean = false) => {
    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (selectedUser) {
        query = query.eq('user_id', selectedUser.id);
      }
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }
      if (statusFilter === 'read') {
        query = query.eq('is_read', true);
      } else if (statusFilter === 'unread') {
        query = query.eq('is_read', false);
      }
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

      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);

      if (error) throw error;

      // Buscar nomes dos usuários
      const userIds = [...new Set((data || []).map(n => n.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds);
      const profileMap = new Map<string, string>(
        profiles?.map(p => [p.id, p.display_name || 'Usuário']) || []
      );

      const enriched = (data || []).map(n => ({
        ...n,
        user_name: profileMap.get(n.user_id) || 'Usuário',
      }));

      if (reset) {
        setNotifs(enriched);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setNotifs(prev => [...prev, ...enriched]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast({ title: 'Erro ao carregar notificações', variant: 'destructive' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadNotifs(true);
  }, [selectedUser, typeFilter, statusFilter, dateFilter]);

  // GAP-D172: Realtime
  useRealtimeRefresh(['notifications'], () => loadNotifs(true), 'admin-notificacoes');

  // GAP-D167: Marcar todas como lidas por usuário
  const markAllAsRead = async (userId: string) => {
    setMarkingAll(true);
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      toast({ title: 'Erro ao marcar todas', description: error.message, variant: 'destructive' });
      setMarkingAll(false);
      return;
    }

    await adminLog({
      action: 'mark_all_notifications_read',
      entity: 'notifications',
      reason: `Todas as notificações marcadas como lidas para usuário ${userId}`,
      payload: { user_id: userId, count: notifs.filter(n => n.user_id === userId && !n.is_read).length },
    });

    setNotifs(prev => prev.map(n =>
      n.user_id === userId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
    ));

    toast({ title: 'Todas as notificações marcadas como lidas' });
    setMarkingAll(false);
  };

  // GAP-D168: Exportar CSV
  const exportCSV = () => {
    const data = notifs.map(n => ({
      Usuário: n.user_name,
      Tipo: typeLabels[n.type] || n.type,
      Título: n.title,
      Conteúdo: n.body || '',
      Status: n.is_read ? 'Lida' : 'Não lida',
      Data: formatDateTime(n.created_at),
      Lida_em: n.read_at ? formatDateTime(n.read_at) : '',
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
    a.download = `notificacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado com sucesso' });
  };

  // GAP-D175: Estatísticas por tipo
  const typeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    notifs.forEach(n => {
      stats[n.type] = (stats[n.type] || 0) + 1;
    });
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [notifs]);

  // GAP-D174: Agrupar por data
  const groupByDate = (items: Notif[]) => {
    const groups: Record<string, Notif[]> = {};
    items.forEach(n => {
      const date = n.created_at.slice(0, 10);
      if (!groups[date]) groups[date] = [];
      groups[date].push(n);
    });
    return groups;
  };

  // Filtrar usuários
  const users = useMemo(() => {
    const m = new Map<string, { id: string; name: string; total: number; unread: number; lastAt: string }>();
    notifs.forEach(n => {
      const ex = m.get(n.user_id);
      if (!ex) {
        m.set(n.user_id, {
          id: n.user_id,
          name: n.user_name,
          total: 1,
          unread: n.is_read ? 0 : 1,
          lastAt: n.created_at,
        });
      } else {
        ex.total++;
        if (!n.is_read) ex.unread++;
        if (n.created_at > ex.lastAt) ex.lastAt = n.created_at;
      }
    });
    const all = [...m.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    const q = search.trim().toLowerCase();
    return q ? all.filter(u => u.name.toLowerCase().includes(q)) : all;
  }, [notifs, search]);

  const userNotifs = useMemo(() => {
    return selectedUser ? notifs.filter(n => n.user_id === selectedUser.id) : [];
  }, [notifs, selectedUser]);

  const totalUnread = notifs.filter(n => !n.is_read).length;

  // GAP-D171: Abrir detalhes
  const openDetail = (notif: Notif) => {
    setDetailNotif(notif);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao marcar notificação', variant: 'destructive' });
      return;
    }

    await adminLog({
      action: 'mark_notification_read',
      entity: 'notifications',
      entity_id: id,
      reason: 'Notificação marcada como lida manualmente',
    });

    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n));
    toast({ title: 'Notificação marcada como lida' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notificações
          </h1>
          <p className="text-muted-foreground text-sm">
            Agrupadas por usuário · {totalUnread} não lidas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Usuários', value: users.length, icon: User, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Total', value: notifs.length, icon: Bell, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Não Lidas', value: totalUnread, icon: Mail, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Lidas', value: notifs.filter(n => n.is_read).length, icon: MailOpen, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Tipos', value: new Set(notifs.map(n => n.type)).size, icon: Tag, color: 'text-accent', bg: 'bg-accent/10' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="py-3 px-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GAP-D175: Tipos mais comuns */}
      {typeStats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground font-medium mr-1">Tipos:</span>
          {typeStats.map(([type, count]) => (
            <Badge key={type} variant="outline" className="text-xs">
              {typeLabels[type] || type}: {count}
            </Badge>
          ))}
        </div>
      )}

      {!selectedUser && (
        <>
          {/* Filtros */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuário..."
                    className="pl-9"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {Object.entries(typeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="unread">Não lidas</SelectItem>
                      <SelectItem value="read">Lidas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todos os períodos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="week">Última semana</SelectItem>
                      <SelectItem value="month">Último mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de usuários */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Usuário</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Não lidas</TableHead>
                    <TableHead>Última</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <EstadoVazio titulo="Nenhuma notificação" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map(u => (
                      <TableRow
                        key={u.id}
                        className="border-border hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelectedUser({ id: u.id, name: u.name })}
                      >
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{u.total}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {u.unread > 0 ? (
                            <Badge className="bg-warning/20 text-warning">{u.unread}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(u.lastAt)}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUser({ id: u.id, name: u.name });
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Ver
                          </Button>
                          {u.unread > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAllAsRead(u.id);
                              }}
                              disabled={markingAll}
                            >
                              <CheckCheck className="h-3 w-3 mr-1" /> Marcar lidas
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {selectedUser && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <h2 className="text-lg font-semibold">
                Notificações de: {selectedUser.name}
              </h2>
              <Badge variant="secondary">{userNotifs.length}</Badge>
            </div>
            <div className="flex gap-2">
              {userNotifs.filter(n => !n.is_read).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsRead(selectedUser.id)}
                  disabled={markingAll}
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Marcar todas lidas
                </Button>
              )}
            </div>
          </div>

          {/* GAP-D174: Agrupamento por data */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              {userNotifs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  Nenhuma notificação para este usuário.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {Object.entries(groupByDate(userNotifs)).map(([date, items]) => (
                    <div key={date}>
                      <div className="px-4 py-2 bg-muted/20 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(date).toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                        <span className="text-muted-foreground/60">({items.length})</span>
                      </div>
                      <Table>
                        <TableBody>
                          {items.map(n => (
                            <TableRow key={n.id} className="border-border hover:bg-muted/30">
                              <TableCell className="py-2">
                                <Badge className={typeColors[n.type] || 'bg-muted text-muted-foreground'}>
                                  {typeLabels[n.type] || n.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2 text-sm font-medium">{n.title}</TableCell>
                              <TableCell className="py-2 text-sm text-muted-foreground truncate max-w-[200px]">
                                {n.body || '—'}
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                {n.is_read ? (
                                  <MailOpen className="h-4 w-4 text-muted-foreground mx-auto" />
                                ) : (
                                  <Mail className="h-4 w-4 text-primary mx-auto" />
                                )}
                              </TableCell>
                              <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(n.created_at).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </TableCell>
                              <TableCell className="py-2 text-right space-x-1 whitespace-nowrap">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => openDetail(n)}
                                >
                                  <Eye className="h-3 w-3 mr-1" /> Detalhes
                                </Button>
                                {!n.is_read && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => markAsRead(n.id)}
                                  >
                                    <CheckCheck className="h-3 w-3 mr-1" /> Lida
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* GAP-D164: Paginação */}
          {hasMore && userNotifs.length >= ITEMS_PER_PAGE && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => loadNotifs(false)}
                disabled={loadingMore}
                className="text-sm"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}

      {/* GAP-D171: Detail Modal */}
      <DetailModal
        open={!!detailNotif}
        onClose={() => setDetailNotif(null)}
        notif={detailNotif}
      />
    </div>
  );
}