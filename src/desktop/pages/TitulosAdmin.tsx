import { useEffect, useMemo, useState } from 'react';
import { Award, Loader2, Plus, Trash2, Search, Download, ChevronLeft, ChevronRight, Filter, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import { useDebounce } from '@/hooks/useDebounce';
import { escapeIlikeTerm } from '@/lib/escapeIlike';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';

const ITEMS_PER_PAGE = 30;

export default function TitulosAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: '', name: '' });
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [filterSearch, setFilterSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [pendingRemove, setPendingRemove] = useState<any | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const debounced = useDebounce(userSearch, 300);

  const sanitizePgrst = escapeIlikeTerm;

  const load = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase.from('user_titles').select('*', { count: 'exact' }).order('awarded_at', { ascending: false });

      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
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
      toast.error('Erro ao carregar títulos');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { load(true); }, [sourceFilter]);

  useEffect(() => {
    const q = sanitizePgrst(debounced || '');
    if (!q || q.length < 2) { setUserResults([]); return; }
    (async () => {
      const { data } = await supabase.from('profiles').select('id, display_name, handle')
        .or(`display_name.ilike.%${q}%,handle.ilike.%${q}%`).limit(8);
      setUserResults(data || []);
    })();
  }, [debounced]);

  // GAP-D315: Preview do título
  const titlePreview = form.name ? (
    <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 text-center">
      <span className="text-lg font-bold text-primary">{form.name}</span>
    </div>
  ) : null;

  // GAP-D312: Filtrar por busca
  const filtered = useMemo(() => {
    const q = filterSearch.toLowerCase();
    return rows.filter(r => 
      (r.name || '').toLowerCase().includes(q) ||
      (r.user_id || '').includes(q) ||
      (r.source || '').toLowerCase().includes(q)
    );
  }, [rows, filterSearch]);

  // GAP-D310: Verificar duplicata
  const award = async () => {
    if (!form.user_id || !form.name) return toast.error('Preencha tudo');

    // Verifica se usuário já tem este título
    const { data: existing } = await supabase.from('user_titles')
      .select('id').eq('user_id', form.user_id).eq('name', form.name).limit(1);
    if (existing && existing.length > 0) {
      return toast.error('Esse usuário já tem esse título.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('user_titles').insert({ 
      ...form, 
      source: 'admin', 
      awarded_by: user?.id 
    } as any).select().single();
    
    if (error) return toast.error(error.message);

    // GAP-D313: adminLog
    await adminLog({ 
      action: 'titulo_award', 
      entity: 'user_title', 
      entity_id: data?.id, 
      payload: form 
    });

    // GAP-D314: Notificar usuário
    await supabase.from('notifications').insert({
      user_id: form.user_id,
      type: 'system',
      title: '🏅 Novo título conquistado!',
      body: `Você recebeu o título "${form.name}"!`,
      reference_type: 'user_title',
      reference_id: data?.id,
    });

    toast.success('Título concedido e usuário notificado');
    setOpen(false); 
    setForm({ user_id: '', name: '' }); 
    setUserSearch(''); 
    load(true);
  };

  // GAP-D313: adminLog com motivo
  const confirmRemove = async () => {
    const r = pendingRemove;
    if (!r) return;
    if (removeReason.trim().length < 4) return toast.error('Motivo muito curto (mínimo 4 caracteres)');
    
    const { error } = await supabase.from('user_titles').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    
    await adminLog({ 
      action: 'titulo_revoke', 
      entity: 'user_title', 
      entity_id: r.id, 
      reason: removeReason, 
      payload: r 
    });

    // GAP-D314: Notificar usuário
    await supabase.from('notifications').insert({
      user_id: r.user_id,
      type: 'system',
      title: '❌ Título removido',
      body: `O título "${r.name}" foi removido. Motivo: ${removeReason}`,
      reference_type: 'user_title',
      reference_id: r.id,
    });

    toast.success('Título removido e usuário notificado');
    setPendingRemove(null); 
    setRemoveReason(''); 
    load(true);
  };

  // GAP-D312: Exportar CSV
  const exportData = () => {
    setExporting(true);
    const data = filtered.map(r => ({
      'ID do Usuário': r.user_id,
      'Título': r.name,
      'Origem': r.source,
      'Concedido por': r.awarded_by || '—',
      'Data': formatDateTime(r.awarded_at),
    }));
    exportCsv(`titulos-${new Date().toISOString().slice(0, 10)}.csv`, data);
    setExporting(false);
    toast.success('CSV exportado com sucesso');
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(0, (page + 1) * ITEMS_PER_PAGE);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader 
        icon={Award} 
        title="Títulos" 
        subtitle="Outorga manual de títulos especiais"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> Conceder</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Conceder título</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Buscar usuário</Label>
                    <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Nome ou @handle" />
                    {userResults.length > 0 && (
                      <div className="border border-border rounded mt-1 max-h-40 overflow-y-auto">
                        {userResults.map(u => (
                          <button key={u.id} type="button" onClick={() => { setForm({ ...form, user_id: u.id }); setUserSearch(u.display_name); setUserResults([]); }}
                            className="w-full text-left p-2 hover:bg-muted text-sm">
                            {u.display_name} <span className="text-muted-foreground">@{u.handle || '—'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {form.user_id && <div className="text-xs text-muted-foreground">User ID: {form.user_id}</div>}
                  <div><Label>Nome do título</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  {/* GAP-D315: Preview */}
                  {titlePreview}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={award}>Conceder</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        } 
      />

      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              className="pl-8" 
              placeholder="Filtrar por nome ou user id..." 
              value={filterSearch} 
              onChange={e => setFilterSearch(e.target.value)} 
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-36">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="auto">Automática</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setFilterSearch(''); setSourceFilter('all'); }}>
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
                <TableHead>Usuário</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Concedido por</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="p-0"><EstadoVazio titulo="Sem títulos" /></TableCell></TableRow>
              ) : paginated.map(r => (
                <TableRow key={r.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    {r.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.source === 'admin' ? 'default' : 'secondary'}>
                      {r.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.awarded_by ? r.awarded_by.slice(0, 8) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(r.awarded_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      aria-label="Excluir" 
                      onClick={() => { setPendingRemove(r); setRemoveReason(''); }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* GAP-D311: Paginação */}
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

      {/* Dialog de remoção */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => { if (!o) { setPendingRemove(null); setRemoveReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover título</AlertDialogTitle>
            <AlertDialogDescription>
              Revogar <b>{pendingRemove?.name}</b>? O usuário será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo (mínimo 4 caracteres)</Label>
            <Input 
              value={removeReason} 
              onChange={e => setRemoveReason(e.target.value)} 
              placeholder="Motivo da remoção" 
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmRemove} 
              className="bg-destructive text-destructive-foreground"
              disabled={removeReason.trim().length < 4}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}