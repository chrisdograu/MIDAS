import { useEffect, useMemo, useState } from 'react';
import { Library, Loader2, Search, Download, ChevronLeft, ChevronRight, Filter, Calendar, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 30;

export default function TrocasArquivadas() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sellerMap, setSellerMap] = useState<Map<string, string>>(new Map());

  const load = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const fromIdx = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase
        .from('trade_proposals')
        .select('*', { count: 'exact' })
        .in('status', ['accepted', 'rejected', 'cancelled'])
        .order('updated_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query.range(fromIdx, fromIdx + ITEMS_PER_PAGE - 1);
      if (error) throw error;

      // Buscar nomes dos usuários
      const userIds = new Set<string>();
      (data || []).forEach((r: any) => {
        if (r.proposer_id) userIds.add(r.proposer_id);
        if (r.seller_id) userIds.add(r.seller_id);
      });
      
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', Array.from(userIds));
        const map = new Map<string, string>();
        (profiles || []).forEach(p => map.set(p.id, p.display_name || 'Usuário'));
        setSellerMap(map);
      }

      if (reset) {
        setRows(data || []);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setRows(prev => [...prev, ...(data || [])]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast.error(`Erro ao carregar trocas: ${error}`);
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { load(true); }, [status]);

  // GAP-D343: Realtime
  useRealtimeRefresh(['trade_proposals'], () => load(true), 'admin-trocas-arquivadas');

  // TODO: 4 filtros (search, sellerSearch, from, to) rodam client-side sobre rows paginados.
  // Mover para .or() / .gte() / .lte() no servidor.
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const sq = sellerSearch.toLowerCase();
    return rows.filter(r => {
      const matchStatus = status === 'all' || r.status === status;
      const matchSearch = !q || 
        (r.offered_item || '').toLowerCase().includes(q) ||
        (r.id || '').includes(q);
      const matchSeller = !sq ||
        (sellerMap.get(r.proposer_id) || '').toLowerCase().includes(sq) ||
        (sellerMap.get(r.seller_id) || '').toLowerCase().includes(sq);
      const d = new Date(r.updated_at || r.created_at);
      const matchFrom = !from || d >= new Date(from);
      const matchTo = !to || d <= new Date(to + 'T23:59:59');
      return matchStatus && matchSearch && matchSeller && matchFrom && matchTo;
    });
  }, [rows, status, search, sellerSearch, from, to, sellerMap]);

  // GAP-D342: adminLog ao visualizar detalhes
  const viewDetail = async (row: any) => {
    await adminLog({
      action: 'view_archived_trade',
      entity: 'trade_proposals',
      entity_id: row.id,
      reason: 'Visualização de troca arquivada',
      payload: {
        status: row.status,
        offered_item: row.offered_item,
        proposer: sellerMap.get(row.proposer_id) || row.proposer_id,
        seller: sellerMap.get(row.seller_id) || row.seller_id,
      }
    });
    // TODO: implementar modal de detalhes. Hoje só mostra toast.
    toast.info(`Visualizando troca #${row.id.slice(0, 8)}`);
  };

  const exportData = () => {
    setExporting(true);
    const data = filtered.map(r => ({
      ID: r.id.slice(0, 8),
      Status: r.status,
      'Item Oferecido': r.offered_item,
      Proponente: sellerMap.get(r.proposer_id) || r.proposer_id,
      Vendedor: sellerMap.get(r.seller_id) || r.seller_id,
      'Confirmou Prop.': r.proposer_confirmed ? 'Sim' : 'Não',
      'Confirmou Vend.': r.seller_confirmed ? 'Sim' : 'Não',
      'Atualizado em': formatDateTime(r.updated_at || r.created_at),
    }));
    exportCsv(`trocas-arquivadas-${new Date().toISOString().slice(0, 10)}.csv`, data);
    setExporting(false);
    toast.success('CSV exportado com sucesso');
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader 
        icon={Library} 
        title="Trocas Arquivadas" 
        subtitle="Histórico de propostas finalizadas"
        actions={
          <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar CSV'}
          </Button>
        } 
      />

      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Buscar item ou ID</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                className="pl-8" 
                placeholder="Item, ID..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Buscar vendedor/proponente</Label>
            <div className="relative">
              <User className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                className="pl-8" 
                placeholder="Nome do usuário..." 
                value={sellerSearch} 
                onChange={e => setSellerSearch(e.target.value)} 
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="accepted">Aceitas</SelectItem>
                <SelectItem value="rejected">Recusadas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-[150px]" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-[150px]" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setSellerSearch(''); setStatus('all'); setFrom(''); setTo(''); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Item oferecido</TableHead>
                <TableHead>Proponente</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Confirmações</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="p-0"><EstadoVazio titulo="Sem trocas arquivadas" /></TableCell></TableRow>
              ) : paginated.map(r => (
                <TableRow key={r.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'accepted' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="truncate max-w-[200px]">{r.offered_item}</TableCell>
                  <TableCell className="text-xs">
                    {sellerMap.get(r.proposer_id) || r.proposer_id?.slice(0, 8) || '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {sellerMap.get(r.seller_id) || r.seller_id?.slice(0, 8) || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 text-xs">
                      <Badge variant={r.proposer_confirmed ? 'default' : 'secondary'} className="text-[10px]">
                        Prop: {r.proposer_confirmed ? '✓' : '✗'}
                      </Badge>
                      <Badge variant={r.seller_confirmed ? 'default' : 'secondary'} className="text-[10px]">
                        Vend: {r.seller_confirmed ? '✓' : '✗'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(r.updated_at || r.created_at)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs"
                      onClick={() => viewDetail(r)}
                    >
                      Ver detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* GAP-D340: Paginação */}
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
    </div>
  );
}