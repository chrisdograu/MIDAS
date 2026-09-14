import { useEffect, useState, useMemo } from 'react';
import { Trophy, Loader2, Search, Download, ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageHeader } from '../components/AdminPageHeader';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';
import { exportCsv } from '../lib/adminLog';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

export default function TorneiosEventos() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase.from('tournaments')
        .select('id,title,event_state,starts_at,ends_at,winner_id,hype_score', { count: 'exact' })
        .in('event_state', ['finished', 'archived'])
        .order('ends_at', { ascending: false });

      if (dateFilter === 'week') {
        const week = new Date();
        week.setDate(week.getDate() - 7);
        query = query.gte('ends_at', week.toISOString());
      } else if (dateFilter === 'month') {
        const month = new Date();
        month.setDate(month.getDate() - 30);
        query = query.gte('ends_at', month.toISOString());
      } else if (dateFilter === 'year') {
        const year = new Date();
        year.setFullYear(year.getFullYear() - 1);
        query = query.gte('ends_at', year.toISOString());
      }

      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;

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
      toast.error('Erro ao carregar eventos');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { load(true); }, [dateFilter]);

  // GAP-D301: Filtro por busca
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => 
      r.title.toLowerCase().includes(q) ||
      (r.event_state || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  // GAP-D302: Exportar CSV
  const exportData = () => {
    setExporting(true);
    const data = filtered.map(r => ({
      Título: r.title,
      Estado: r.event_state,
      Hype: r.hype_score || 0,
      Início: r.starts_at ? formatDateTime(r.starts_at) : '',
      Fim: r.ends_at ? formatDateTime(r.ends_at) : '',
      Vencedor: r.winner_id || '—',
    }));
    exportCsv(`eventos-${new Date().toISOString().slice(0, 10)}.csv`, data);
    setExporting(false);
    toast.success('CSV exportado com sucesso');
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader 
        icon={Trophy} 
        title="Eventos (Histórico)" 
        subtitle="Torneios finalizados e arquivados"
        actions={
          <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar CSV'}
          </Button>
        }
      />

      {/* GAP-D301: Filtros */}
      <Card className="border-border/50">
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar evento..." 
              className="pl-9" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-36">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
              <SelectItem value="year">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDateFilter('all'); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Torneio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Hype</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Encerrou em</TableHead>
                <TableHead>Vencedor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="p-0"><EstadoVazio titulo="Nenhum evento encerrado" /></TableCell></TableRow>
              ) : paginated.map(r => (
                <TableRow key={r.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell><Badge variant="secondary">{r.event_state}</Badge></TableCell>
                  <TableCell>{r.hype_score ?? 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.starts_at ? formatDateTime(r.starts_at) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.ends_at ? formatDateTime(r.ends_at) : '—'}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {r.winner_id ? r.winner_id.slice(0, 8) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* GAP-D300: Paginação */}
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