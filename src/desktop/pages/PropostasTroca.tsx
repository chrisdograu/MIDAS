import { useState, useEffect, useMemo } from 'react';
import { ArrowLeftRight, CheckCircle, XCircle, Clock, Loader2, Gavel, Search, Filter, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { tradeStatusLabels, tradeStatusColors } from '../mockData';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate, formatDateTime } from '@/lib/format';
import { adminLog } from '../lib/adminLog';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { toast } from 'sonner';

interface Proposal {
  id: string; proposer_name: string; seller_name: string; anuncio_title: string;
  offered_item: string; status: string; proposer_confirmed: boolean; seller_confirmed: boolean; created_at: string;
  proposer_id?: string; seller_id?: string; anuncio_id?: string;
}

const ITEMS_PER_PAGE = 20;

export default function PropostasTroca() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [target, setTarget] = useState<{ p: Proposal; acao: 'accepted' | 'cancelled' } | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchProposals = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase.from('trade_proposals').select('*', { count: 'exact' }).order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;
      if (!data) {
        if (reset) setLoading(false);
        else setLoadingMore(false);
        return;
      }

      const proposerIds = [...new Set(data.map(p => p.proposer_id))];
      const anuncioIds = [...new Set(data.map(p => p.anuncio_id))];

      const [{ data: profiles }, { data: anuncios }] = await Promise.all([
        supabase.from('profiles').select('id, display_name').in('id', proposerIds),
        supabase.from('anuncios').select('id, title, seller_id').in('id', anuncioIds),
      ]);

      const profileMap = new Map<string, string>((profiles || []).map(p => [p.id, p.display_name || 'Usuário'] as [string, string]));
      const anuncioMap = new Map<string, any>((anuncios || []).map(a => [a.id, a] as [string, any]));

      const sellerIds = [...new Set(anuncios?.map(a => a.seller_id) || [])];
      const { data: sellerProfiles } = sellerIds.length > 0 ? await supabase.from('profiles').select('id, display_name').in('id', sellerIds) : { data: [] };
      const sellerMap = new Map<string, string>((sellerProfiles || []).map(p => [p.id, p.display_name || 'Vendedor'] as [string, string]));

      const processed = data.map(p => {
        const anuncio = anuncioMap.get(p.anuncio_id);
        return {
          id: p.id, proposer_name: profileMap.get(p.proposer_id) || 'Usuário',
          seller_name: (anuncio ? (sellerMap.get(anuncio.seller_id) || 'Vendedor') : 'Vendedor') as string,
          anuncio_title: anuncio?.title || 'Anúncio', offered_item: p.offered_item,
          status: p.status, proposer_confirmed: p.proposer_confirmed,
          seller_confirmed: p.seller_confirmed, created_at: p.created_at,
          proposer_id: p.proposer_id, seller_id: anuncio?.seller_id, anuncio_id: p.anuncio_id,
        };
      });

      if (reset) {
        setProposals(processed);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setProposals(prev => [...prev, ...processed]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast.error(`Erro ao carregar propostas: ${error}`);
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { fetchProposals(true); }, [statusFilter]);

  // GAP-D236: Realtime
  useRealtimeRefresh(['trade_proposals'], () => fetchProposals(true), 'admin-propostas-troca');

  // GAP-D235: Notificação ao usuário
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

  const mediar = async () => {
    if (!target) return;
    if (!reason.trim()) { toast.error('Descreva o motivo da mediação'); return; }
    setSaving(true);
    const { error } = await supabase.from('trade_proposals')
      .update({ status: target.acao }).eq('id', target.p.id);
    if (error) {
      setSaving(false);
      toast.error(`Erro ao mediar proposta: ${error.message}`);
      return;
    }

    // GAP-D234: adminLog detalhado
    await adminLog({
      action: target.acao === 'accepted' ? 'mediate_trade_accept' : 'mediate_trade_cancel',
      entity: 'trade_proposals', entity_id: target.p.id, reason: reason.trim(),
      payload: {
        anuncio: target.p.anuncio_title, item_oferecido: target.p.offered_item,
        proponente: target.p.proposer_name, vendedor: target.p.seller_name,
        antes: { status: target.p.status }, depois: { status: target.acao },
      },
    });

    // GAP-D235: Notificar proponente e vendedor
    if (target.acao === 'accepted') {
      await notifyUser(
        target.p.proposer_id || '',
        '✅ Troca aprovada pela moderação',
        `Sua proposta de troca para "${target.p.anuncio_title}" foi aprovada.`,
        'trade_proposal', target.p.id
      );
      await notifyUser(
        target.p.seller_id || '',
        '✅ Troca aprovada pela moderação',
        `A proposta de troca de ${target.p.proposer_name} para "${target.p.anuncio_title}" foi aprovada.`,
        'trade_proposal', target.p.id
      );
    } else {
      await notifyUser(
        target.p.proposer_id || '',
        '❌ Troca cancelada pela moderação',
        `Sua proposta de troca para "${target.p.anuncio_title}" foi cancelada. Motivo: ${reason.trim()}`,
        'trade_proposal', target.p.id
      );
      await notifyUser(
        target.p.seller_id || '',
        '❌ Troca cancelada pela moderação',
        `A proposta de troca de ${target.p.proposer_name} para "${target.p.anuncio_title}" foi cancelada. Motivo: ${reason.trim()}`,
        'trade_proposal', target.p.id
      );
    }

    toast.success(target.acao === 'accepted' ? 'Troca aprovada e usuários notificados' : 'Troca cancelada e usuários notificados');
    setSaving(false); setTarget(null); setReason('');
    fetchProposals(true);
  };

  // GAP-D233: Exportar CSV
  const exportCSV = () => {
    setExporting(true);
    const data = filtered.map(p => ({
      Proponente: p.proposer_name,
      Vendedor: p.seller_name,
      Anúncio: p.anuncio_title,
      'Item Oferecido': p.offered_item,
      Status: tradeStatusLabels[p.status] || p.status,
      'Prop. Confirmou': p.proposer_confirmed ? 'Sim' : 'Não',
      'Vend. Confirmou': p.seller_confirmed ? 'Sim' : 'Não',
      Data: formatDateTime(p.created_at),
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
    a.download = `propostas-troca-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success('CSV exportado com sucesso');
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return proposals.filter(p =>
      p.proposer_name.toLowerCase().includes(q) ||
      p.seller_name.toLowerCase().includes(q) ||
      p.anuncio_title.toLowerCase().includes(q) ||
      p.offered_item.toLowerCase().includes(q)
    );
  }, [proposals, search]);

  const counts = {
    pending: proposals.filter(p => p.status === 'pending').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    rejected: proposals.filter(p => p.status === 'rejected').length,
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(0, (page + 1) * ITEMS_PER_PAGE);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ArrowLeftRight className="h-6 w-6 text-primary" /> Propostas de Troca</h1>
          <p className="text-muted-foreground text-sm">{proposals.length} propostas registradas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* GAP-D231: Cards de status com filtro */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pendentes', value: counts.pending, icon: Clock, color: 'text-warning', bg: 'bg-warning/10', status: 'pending' },
          { label: 'Aceitas', value: counts.accepted, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', status: 'accepted' },
          { label: 'Recusadas', value: counts.rejected, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', status: 'rejected' },
        ].map(s => (
          <Card 
            key={s.label} 
            className={`border-border/50 cursor-pointer hover:border-primary/30 transition-colors ${statusFilter === s.status ? 'border-primary/50 bg-primary/5' : ''}`}
            onClick={() => setStatusFilter(statusFilter === s.status ? 'all' : s.status)}
          >
            <CardContent className="py-4 px-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
              <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por usuário ou anúncio..." 
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
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="accepted">Aceitas</SelectItem>
              <SelectItem value="rejected">Recusadas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="border-border">
              <TableHead>Proponente</TableHead><TableHead>Vendedor</TableHead><TableHead>Anúncio</TableHead>
              <TableHead>Item Oferecido</TableHead><TableHead className="text-center">Confirmações</TableHead>
              <TableHead className="text-center">Status</TableHead><TableHead>Data</TableHead>
              <TableHead className="text-center">Mediação</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="p-0"><EstadoVazio titulo="Nenhuma proposta encontrada" /></TableCell></TableRow>
              ) : paginated.map(p => (
                <TableRow key={p.id} className="border-border hover:bg-muted/30">
                  <TableCell className="text-sm font-medium truncate max-w-[160px]">{p.proposer_name}</TableCell>
                  <TableCell className="text-sm truncate max-w-[160px]">{p.seller_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{p.anuncio_title}</TableCell>
                  <TableCell className="text-sm truncate max-w-[200px]">{p.offered_item}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex gap-2 justify-center text-xs">
                      <span className={p.proposer_confirmed ? 'text-success' : 'text-muted-foreground'}>Prop: {p.proposer_confirmed ? '✓' : '✗'}</span>
                      <span className={p.seller_confirmed ? 'text-success' : 'text-muted-foreground'}>Vend: {p.seller_confirmed ? '✓' : '✗'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center"><Badge className={tradeStatusColors[p.status] || ''}>{tradeStatusLabels[p.status] || p.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                  <TableCell className="text-center">
                    {p.status === 'pending' ? (
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => { setTarget({ p, acao: 'accepted' }); setReason(''); }}>
                          <Gavel className="h-3 w-3 mr-1" />Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive"
                          onClick={() => { setTarget({ p, acao: 'cancelled' }); setReason(''); }}>
                          Cancelar
                        </Button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* GAP-D230: Paginação */}
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

      {/* Dialog de mediação */}
      <AlertDialog open={!!target} onOpenChange={o => { if (!o) { setTarget(null); setReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.acao === 'accepted' ? 'Aprovar troca por mediação?' : 'Cancelar troca por mediação?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Proposta de {target?.p.proposer_name} no anúncio "{target?.p.anuncio_title}". 
              A ação fica registrada nos logs administrativos e os usuários serão notificados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Motivo da mediação (obrigatório)</Label>
            <Input 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              placeholder="Ex: usuário não respondeu em 72h" 
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); mediar(); }} disabled={saving || !reason.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}