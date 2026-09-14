import { useEffect, useState, useMemo } from 'react';
import { Store, Loader2, Search, Eye, PalmtreeIcon, Ban, Download, ChevronLeft, ChevronRight, Filter, History, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { adminLog, exportCsv } from '@/desktop/lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';

interface Seller {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  rating: number | null;
  total_sales: number | null;
  vacation_mode: boolean | null;
  vacation_message: string | null;
  admin_suspended: boolean | null;
  admin_suspension_reason: string | null;
  admin_suspended_at: string | null;
  created_at: string;
}

interface HistoryEntry {
  id: string;
  action: string;
  reason: string | null;
  payload: any;
  created_at: string;
  admin_name: string;
}

const ITEMS_PER_PAGE = 20;

export default function VendedoresAdmin() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editing, setEditing] = useState<Seller | null>(null);
  const [draftMode, setDraftMode] = useState(false);
  const [draftMsg, setDraftMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [draftSuspended, setDraftSuspended] = useState(false);
  const [draftSuspReason, setDraftSuspReason] = useState('');
  const [historyOpen, setHistoryOpen] = useState<Seller | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState<{ seller: Seller; suspend: boolean } | null>(null);

  const load = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase.from('seller_profiles')
        .select('*', { count: 'exact' })
        .order('display_name');

      if (statusFilter === 'vacation') {
        query = query.eq('vacation_mode', true);
      } else if (statusFilter === 'suspended') {
        query = query.eq('admin_suspended', true);
      } else if (statusFilter === 'active') {
        query = query.eq('admin_suspended', false).eq('vacation_mode', false);
      }

      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;

      if (reset) {
        setSellers((data || []) as Seller[]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setSellers(prev => [...prev, ...((data || []) as Seller[])]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast.error('Erro ao carregar vendedores');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { load(true); }, [statusFilter]);

  // GAP-D323: Carregar histórico
  const loadHistory = async (seller: Seller) => {
    setHistoryOpen(seller);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('admin_logs')
      .select('*')
      .eq('entity', 'seller_profile')
      .eq('entity_id', seller.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const adminIds = [...new Set((data || []).map(log => log.admin_id).filter(Boolean))];
    let adminMap = new Map<string, string>();
    if (adminIds.length) {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', adminIds);
      adminMap = new Map((admins || []).map(a => [a.id, a.display_name || 'Admin']));
    }

    setHistoryEntries((data || []).map(log => ({
      ...log,
      admin_name: adminMap.get(log.admin_id) || 'Sistema'
    })));
    setLoadingHistory(false);
  };

  const openEditor = (s: Seller) => {
    setEditing(s);
    setDraftMode(!!s.vacation_mode);
    setDraftMsg(s.vacation_message || '');
    setDraftSuspended(!!s.admin_suspended);
    setDraftSuspReason(s.admin_suspension_reason || '');
  };

  // GAP-D324: Notificar vendedor
  const notifySeller = async (userId: string, title: string, body: string) => {
    if (!userId) return;
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'system',
      title,
      body,
      reference_type: 'seller_profile',
    });
  };

  const save = async () => {
    if (!editing) return;
    if (draftSuspended && draftSuspReason.trim().length < 6) {
      toast.error('Descreva o motivo da suspensão (mínimo de 6 caracteres).');
      return;
    }
    setSaving(true);
    const suspensionChanged = !!editing.admin_suspended !== draftSuspended;
    const vacationChanged = !!editing.vacation_mode !== draftMode;

    const { error } = await supabase.from('seller_profiles')
      .update({
        vacation_mode: draftMode,
        vacation_message: draftMsg || null,
        admin_suspended: draftSuspended,
        admin_suspension_reason: draftSuspended ? draftSuspReason.trim() : null,
        admin_suspended_at: draftSuspended ? (editing.admin_suspended ? undefined : new Date().toISOString()) : null,
      } as any)
      .eq('id', editing.id);

    if (error) { toast.error(error.message || 'Erro ao salvar'); setSaving(false); return; }

    // GAP-D323: adminLog
    if (suspensionChanged) {
      await adminLog({
        action: draftSuspended ? 'seller_suspended' : 'seller_unsuspended',
        entity: 'seller_profile',
        entity_id: editing.id,
        reason: draftSuspReason.trim() || 'Suspensão administrativa',
        payload: { handle: editing.handle, reason: draftSuspReason.trim() || null },
      });

      // GAP-D324: Notificar
      await notifySeller(
        editing.user_id,
        draftSuspended ? '⚠️ Sua conta de vendedor foi suspensa' : '✅ Suspensão removida',
        draftSuspended 
          ? `Sua loja foi suspensa. Motivo: ${draftSuspReason.trim() || 'Não informado'}`
          : 'Sua loja foi reativada. Você pode voltar a vender normalmente.'
      );
    }

    if (vacationChanged) {
      await adminLog({
        action: draftMode ? 'seller_vacation_on' : 'seller_vacation_off',
        entity: 'seller_profile',
        entity_id: editing.id,
        reason: draftMode ? 'Modo férias ativado' : 'Modo férias desativado',
        payload: {
          handle: editing.handle,
          previous: { vacation_mode: editing.vacation_mode, vacation_message: editing.vacation_message },
          next: { vacation_mode: draftMode, vacation_message: draftMsg || null },
        },
      });

      await notifySeller(
        editing.user_id,
        draftMode ? '🏖️ Modo férias ativado' : '🏖️ Modo férias desativado',
        draftMode 
          ? 'Sua loja está em modo férias. Seus anúncios estão ocultos.'
          : 'Sua loja está novamente disponível para vendas.'
      );
    }

    toast.success(suspensionChanged ? (draftSuspended ? 'Vendedor suspenso e notificado' : 'Suspensão removida e vendedor notificado') : 'Vendedor atualizado');
    setSaving(false);
    setEditing(null);
    load(true);
  };

  // GAP-D322: Exportar CSV
  const exportData = () => {
    setExporting(true);
    const data = filtered.map(s => ({
      Nome: s.display_name,
      Handle: `$${s.handle}`,
      Vendas: s.total_sales || 0,
      Nota: Number(s.rating || 0).toFixed(1),
      'Modo Férias': s.vacation_mode ? 'Ativo' : 'Inativo',
      Status: s.admin_suspended ? 'Suspenso' : 'Ativo',
      'Criado em': formatDateTime(s.created_at),
    }));
    exportCsv(`vendedores-${new Date().toISOString().slice(0, 10)}.csv`, data);
    setExporting(false);
    toast.success('CSV exportado com sucesso');
  };

  // TODO: busca é client-side sobre sellers paginados.
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sellers.filter(s =>
      s.display_name?.toLowerCase().includes(q) ||
      s.handle?.toLowerCase().includes(q)
    );
  }, [sellers, search]);

  const onVacation = sellers.filter(s => s.vacation_mode).length;
  const suspended = sellers.filter(s => s.admin_suspended).length;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6 text-primary" /> Vendedores</h1>
          <p className="text-sm text-muted-foreground">Gerencie perfis de vendedor, modo férias e suspensões.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportData} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar CSV'}
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm"><PalmtreeIcon className="h-3.5 w-3.5 mr-1" /> {onVacation} em férias</Badge>
            <Badge className="text-sm bg-destructive/15 text-destructive border-destructive/40"><Ban className="h-3.5 w-3.5 mr-1" /> {suspended} suspensos</Badge>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Buscar por nome ou @handle" 
                className="pl-9" 
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="vacation">Em férias</SelectItem>
                <SelectItem value="suspended">Suspensos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
              Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead>Vendas</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Férias</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="p-0"><EstadoVazio titulo="Nenhum vendedor encontrado" /></TableCell></TableRow>
              ) : paginated.map(s => (
                <TableRow key={s.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-medium">{s.display_name}</TableCell>
                  <TableCell className="text-muted-foreground">${s.handle}</TableCell>
                  <TableCell>{s.total_sales ?? 0}</TableCell>
                  <TableCell>{Number(s.rating ?? 0).toFixed(1)}</TableCell>
                  <TableCell>
                    {s.vacation_mode
                      ? <Badge className="bg-warning/20 text-warning border-warning/40">🏖️ Ativo</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {s.admin_suspended
                      ? <Badge className="bg-destructive/15 text-destructive border-destructive/40">Suspenso</Badge>
                      : <Badge variant="secondary">Ativo</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => loadHistory(s)} title="Histórico">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditor(s)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Gerenciar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginação */}
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

      {/* Dialog de edição */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar vendedor — {editing?.display_name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-sm">Ativar modo férias</p>
                  <p className="text-xs text-muted-foreground">Oculta os anúncios ativos para visitantes.</p>
                </div>
                <Switch checked={draftMode} onCheckedChange={setDraftMode} />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Mensagem para os visitantes</label>
                <Textarea
                  value={draftMsg}
                  onChange={e => setDraftMsg(e.target.value.slice(0, 240))}
                  placeholder="Ex.: Estou de férias até 30/07 — volto respondendo tudo assim que chegar!"
                  rows={3}
                />
                <p className="text-[11px] text-muted-foreground mt-1 text-right">{draftMsg.length}/240</p>
              </div>

              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm flex items-center gap-1.5"><Ban className="h-4 w-4 text-destructive" /> Suspender vendedor</p>
                    <p className="text-xs text-muted-foreground">Retira a loja e os anúncios do marketplace.</p>
                  </div>
                  <Switch checked={draftSuspended} onCheckedChange={setDraftSuspended} />
                </div>
                {draftSuspended && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Motivo da suspensão</label>
                    <Textarea
                      value={draftSuspReason}
                      onChange={e => setDraftSuspReason(e.target.value.slice(0, 300))}
                      placeholder="Ex.: anúncios repetidos com fotos de terceiros — em análise."
                      rows={2}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Fica registrado no log administrativo.</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Pré-visualização</p>
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 flex items-start gap-3">
                  <span className="text-2xl">🏖️</span>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-warning">
                      {draftMode ? `${editing.display_name} está em modo férias` : 'Modo férias desativado'}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {draftMode
                        ? (draftMsg || 'Os anúncios estão temporariamente ocultos. Ele volta em breve.')
                        : 'A loja aparece normalmente para os visitantes.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* GAP-D323: Histórico */}
      <Dialog open={!!historyOpen} onOpenChange={(o) => { if (!o) setHistoryOpen(null); }}>
        <DialogContent className="max-w-xl max-h-[70vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico — {historyOpen?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {loadingHistory ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : historyEntries.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">Nenhuma alteração registrada</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {historyEntries.map(entry => (
                  <div key={entry.id} className="bg-muted/30 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{entry.action}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(entry.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">por {entry.admin_name}</p>
                    {entry.reason && <p className="text-xs mt-1">{entry.reason}</p>}
                    {entry.payload && (
                      <pre className="text-[10px] bg-muted p-2 rounded mt-1 overflow-x-auto max-h-20">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}