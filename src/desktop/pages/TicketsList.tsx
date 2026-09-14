import { useEffect, useMemo, useState } from 'react';
import { LifeBuoy, Loader2, Search, Download, UserCheck, ChevronLeft, ChevronRight, Clock, AlertCircle, MessageSquare, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import EstadoVazio from '@/components/EstadoVazio';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import { formatDateTime } from '@/lib/format';

interface Props { channel: 'mobile' | 'web' }

const ITEMS_PER_PAGE = 15;

export default function TicketsList({ channel }: Props) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyOpen, setHistoryOpen] = useState<any | null>(null);
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const load = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase
        .from('tickets')
        .select('*', { count: 'exact' })
        .eq('channel', channel)
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (assignedFilter === 'me') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) query = query.eq('assigned_to', user.id);
      }

      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;

      if (reset) {
        setTickets(data || []);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setTickets(prev => [...prev, ...(data || [])]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast.error('Erro ao carregar tickets');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { load(true); }, [channel, status, assignedFilter]);

  // Realtime
  useRealtimeRefresh(['tickets', 'ticket_messages'], () => load(true), 'admin-tickets');

  // GAP-D270: Paginação
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tickets.filter(t =>
      (t.subject || '').toLowerCase().includes(q) ||
      (t.body || '').toLowerCase().includes(q) ||
      (t.id || '').toLowerCase().includes(q)
    );
  }, [tickets, search]);

  // GAP-D276: SLA melhorado
  const slaInfo = (t: any) => {
    const hours = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 3600000);
    if (t.status === 'closed') return { label: 'Fechado', variant: 'default' as const, urgent: false };
    if (hours > 48) return { label: `${hours}h (Urgente)`, variant: 'destructive' as const, urgent: true };
    if (hours > 24) return { label: `${hours}h (Atenção)`, variant: 'secondary' as const, urgent: false };
    return { label: `${hours}h`, variant: 'default' as const, urgent: false };
  };

  // GAP-D274: Histórico de mensagens
  const openHistory = async (t: any) => {
    setHistoryOpen(t);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', t.id)
      .order('created_at', { ascending: true });
    
    const userIds = [...new Set((data || []).map(m => m.sender_id).filter(Boolean))];
    const { data: profiles } = userIds.length > 0 
      ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
      : { data: [] };
    const pm = new Map((profiles || []).map(p => [p.id, p.display_name || 'Usuário']));
    
    setHistoryMessages((data || []).map(m => ({
      ...m,
      sender_name: pm.get(m.sender_id) || 'Sistema'
    })));
    setLoadingHistory(false);
  };

  // GAP-D273: Notificação ao usuário
  const notifyUser = async (userId: string, title: string, body: string, refType: string, refId: string) => {
    if (!userId) return;
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'system',
      title,
      body,
      reference_type: refType,
      reference_id: refId,
    });
  };

  const sendReply = async (t: any) => {
    const text = (reply[t.id] || '').trim(); if (!text) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error('Usuário não autenticado');

    const { error } = await supabase.from('ticket_messages').insert({ 
      ticket_id: t.id, 
      sender_id: user.id, 
      content: text 
    } as any);
    if (error) return toast.error(error.message);

    const { error: err } = await supabase.from('tickets').update({ status: 'answered' } as any).eq('id', t.id);
    if (err) return toast.error(err.message);

    // GAP-D272: adminLog detalhado
    await adminLog({
      action: 'ticket_reply',
      entity: 'ticket',
      entity_id: t.id,
      reason: `Resposta enviada ao ticket #${t.id.slice(0, 8)}`,
      payload: { 
        channel, 
        subject: t.subject, 
        content: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        ticket_status: 'answered'
      }
    });

    // GAP-D273: Notificar usuário
    await notifyUser(
      t.user_id,
      '💬 Nova resposta no seu ticket',
      `O administrador respondeu ao seu ticket "${t.subject}".`,
      'ticket',
      t.id    );

    toast.success('Resposta enviada e usuário notificado');
    setReply({ ...reply, [t.id]: '' });
    load(true);
  };

  const close = async (t: any) => {
    const reason = prompt('Motivo do fechamento (opcional):') || '';
    const { error: errClose } = await supabase.from('tickets').update({ status: 'closed' } as any).eq('id', t.id);
    if (errClose) return toast.error(errClose.message);

    // GAP-D272: adminLog
    await adminLog({
      action: 'ticket_close',
      entity: 'ticket',
      entity_id: t.id,
      reason: reason || 'Ticket fechado pelo admin',
      payload: { channel, subject: t.subject, status: 'closed' }
    });

    // GAP-D273: Notificar usuário
    await notifyUser(
      t.user_id,
      '🔒 Ticket fechado',
      `O ticket "${t.subject}" foi fechado. ${reason ? `Motivo: ${reason}` : ''}`,
      'ticket',
      t.id
    );

    toast.success('Ticket fechado e usuário notificado');
    load(true);
  };

  const assignToMe = async (t: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error('Usuário não autenticado');

    const { error: errAssign } = await supabase.from('tickets').update({ assigned_to: user.id } as any).eq('id', t.id);
    if (errAssign) return toast.error(errAssign.message);

    // GAP-D272: adminLog
    await adminLog({
      action: 'ticket_assign',
      entity: 'ticket',
      entity_id: t.id,
      reason: `Ticket #${t.id.slice(0, 8)} atribuído`,
      payload: { assigned_to: user.id, subject: t.subject }
    });

    toast.success('Ticket atribuído a você');
    load(true);
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(0, (page + 1) * ITEMS_PER_PAGE);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader 
        icon={LifeBuoy} 
        title={`Tickets ${channel === 'mobile' ? 'Mobile (chat)' : 'Web (email)'}`}
        subtitle={channel === 'mobile' ? 'Suporte por chat do app mobile' : 'Tickets recebidos via formulário web'}
        actions={
          <Button variant="outline" size="sm" onClick={() => exportCsv(`tickets_${channel}.csv`, filtered)}>
            <Download className="h-4 w-4 mr-1" />Exportar
          </Button>
        } 
      />

      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                className="pl-8" 
                placeholder="Assunto, corpo ou ID..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="answered">Respondidos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* GAP-D271: Filtro por atribuição */}
          <div>
            <Label className="text-xs">Atribuição</Label>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="me">Atribuídos a mim</SelectItem>
                <SelectItem value="unassigned">Não atribuídos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatus('all'); setAssignedFilter('all'); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EstadoVazio titulo={`Nenhum ticket ${channel}`} descricao="Quando um cliente abrir um atendimento, ele aparece aqui." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Atribuído</TableHead>
                  <TableHead className="w-[35%]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(t => {
                  const sla = slaInfo(t);
                  return (
                    <TableRow key={t.id} className={sla.urgent ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        <div className="font-medium">{t.subject}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{t.body}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <span>{formatDateTime(t.created_at)}</span>
                          <Badge variant="outline" className="text-[10px]">#{t.id.slice(0, 8)}</Badge>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-5 px-1 text-[10px]"
                            onClick={() => openHistory(t)}
                          >
                            <History className="h-3 w-3 mr-1" />Histórico
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.status === 'open' ? 'destructive' : t.status === 'answered' ? 'default' : 'secondary'}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sla.variant} className="flex items-center gap-1">
                          {sla.urgent && <AlertCircle className="h-3 w-3" />}
                          {sla.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {t.assigned_to ? (
                          <span className="flex items-center gap-1">
                            <UserCheck className="h-3 w-3 text-primary" />
                            {t.assigned_to.slice(0, 8)}
                          </span>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => assignToMe(t)}>
                            Atribuir-me
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Textarea 
                            rows={2} 
                            placeholder={t.status === 'closed' ? 'Ticket fechado' : 'Resposta...'} 
                            value={reply[t.id] || ''} 
                            onChange={e => setReply({ ...reply, [t.id]: e.target.value })}
                            disabled={t.status === 'closed'}
                          />
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => sendReply(t)} 
                              disabled={t.status === 'closed' || !reply[t.id]?.trim()}
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />Responder
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => close(t)} 
                              disabled={t.status === 'closed'}
                            >
                              Fechar
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GAP-D270: Paginação */}
      {filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Mostrando {Math.min((page + 1) * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs flex items-center px-2">{page + 1} / {totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={!hasMore || (page + 1) * ITEMS_PER_PAGE >= filtered.length} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* GAP-D274: Histórico de mensagens */}
      <Dialog open={!!historyOpen} onOpenChange={(o) => { if (!o) setHistoryOpen(null); }}>
        <DialogContent className="max-w-xl max-h-[70vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Histórico do Ticket
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{historyOpen?.subject}</p>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {loadingHistory ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : historyMessages.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">Nenhuma mensagem</p>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                <div className="text-xs text-muted-foreground text-center py-2 border-b border-border">
                  Criado em {formatDateTime(historyOpen?.created_at)}
                </div>
                {historyMessages.map(m => {
                  const isAdmin = m.sender_id !== historyOpen?.user_id;
                  return (
                    <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-lg ${isAdmin ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
                        <div className="text-xs font-semibold flex items-center gap-2">
                          <span>{m.sender_name}</span>
                          <span className="text-muted-foreground font-normal text-[10px]">
                            {formatDateTime(m.created_at)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap mt-1">{m.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}