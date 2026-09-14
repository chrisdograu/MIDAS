import { useEffect, useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Activity, Undo2, Download, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/format';
import { exportCsv } from '../lib/adminLog';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

export default function EntityTimelineDrawer({
  open, onOpenChange, entity, entityId, title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entity: string;
  entityId: string | null;
  title?: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uniqueActions, setUniqueActions] = useState<string[]>([]);

  // GAP-D376: Paginação
  const load = async (reset: boolean = true) => {
    if (!entityId) return;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const fromIdx = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase
        .from('admin_logs')
        .select('*', { count: 'exact' })
        .eq('entity', entity)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error, count } = await query.range(fromIdx, fromIdx + ITEMS_PER_PAGE - 1);
      if (error) throw error;

      // GAP-D375: Extrair ações únicas para filtro
      if (reset) {
        const allActions = await supabase
          .from('admin_logs')
          .select('action')
          .eq('entity', entity)
          .eq('entity_id', entityId);
        const actions = [...new Set((allActions.data || []).map(r => r.action))];
        setUniqueActions(actions);
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
      toast.error('Erro ao carregar histórico');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!open || !entityId) return;
    load(true);
  }, [open, entity, entityId, actionFilter]);

  // GAP-D375: Filtrar por busca
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r =>
      (r.action || '').toLowerCase().includes(q) ||
      (r.reason || '').toLowerCase().includes(q) ||
      (r.admin_name || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  // GAP-D377: Exportar
  const exportData = () => {
    setExporting(true);
    const data = filtered.map(r => ({
      Ação: r.action,
      Motivo: r.reason || '—',
      Payload: JSON.stringify(r.payload || {}),
      Data: formatDateTime(r.created_at),
      Revertido: r.reverted_at ? 'Sim' : 'Não',
    }));
    exportCsv(`timeline_${entity}_${entityId?.slice(0, 8)}.csv`, data);
    setExporting(false);
    toast.success('Histórico exportado com sucesso');
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(0, (page + 1) * ITEMS_PER_PAGE);

  if (!entityId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> {title || 'Timeline'}
          </SheetTitle>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={exportData} disabled={exporting}>
              <Download className="h-3.5 w-3.5 mr-1" />
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Exportar'}
            </Button>
          </div>
        </SheetHeader>

        {/* GAP-D375: Filtros */}
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[120px]">
              <Label className="text-[10px] text-muted-foreground">Filtrar ação</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueActions.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <Label className="text-[10px] text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input 
                  className="pl-7 h-8 text-xs" 
                  placeholder="Ação, motivo..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-[10px]"
            onClick={() => { setActionFilter('all'); setSearch(''); }}
          >
            Limpar filtros
          </Button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : paginated.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem registros para este item.</p>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {paginated.map(r => (
                <div key={r.id} className="border-l-2 border-primary/40 pl-3 py-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={r.reverted_at ? 'secondary' : 'default'} className="font-mono text-[10px]">{r.action}</Badge>
                    {r.reverted_at && <Badge variant="outline" className="text-[10px]"><Undo2 className="h-3 w-3 mr-1" />revertido</Badge>}
                    <span className="text-[10px] text-muted-foreground">{formatDateTime(r.created_at)}</span>
                  </div>
                  {r.reason && <p className="text-xs mt-1">{r.reason}</p>}
                  {r.payload && Object.keys(r.payload).length > 0 && (
                    <pre className="text-[10px] bg-muted/40 rounded p-1.5 mt-1 overflow-x-auto max-h-32">{JSON.stringify(r.payload, null, 2)}</pre>
                  )}
                </div>
              ))}
            </div>

            {/* GAP-D376: Paginação */}
            {filtered.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between mt-4 pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground">
                  {Math.min((page + 1) * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[10px] flex items-center px-2">{page + 1} / {totalPages || 1}</span>
                  <Button variant="outline" size="sm" disabled={!hasMore || (page + 1) * ITEMS_PER_PAGE >= filtered.length} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}