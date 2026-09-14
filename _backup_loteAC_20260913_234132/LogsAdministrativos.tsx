import { useEffect, useMemo, useState } from 'react';
import { Shield, Loader2, Undo2, Download, Search, Eye, Filter, ChevronLeft, ChevronRight, FileText, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime } from '@/lib/format';
import { dbWrite } from '@/lib/dbWrite';

const ITEMS_PER_PAGE = 50;

// GAP-D155: Tipos de ação que podem ser revertidas
const REVERTIBLE_ACTIONS = new Set([
  'delete_product',
  'ban_user',
  'delete_employee',
  'denuncia_ban',
  'denuncia_warn',
  'moderacao_ban',
  'excluir_post_forum',
  'delete_catalog_game',
  'hide_review',
  'hide_comment',
  'remove_screenshot',
  'delete_opinion',
]);

interface LogEntry {
  id: string;
  admin_id: string;
  action: string;
  entity: string;
  entity_id: string;
  reason: string | null;
  payload: any;
  created_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
  revert_reason: string | null;
  profiles?: {
    display_name: string;
  };
}

// GAP-D156: Filtros
interface Filters {
  entity: string;
  action: string;
  status: 'all' | 'active' | 'reverted';
  from: string;
  to: string;
  search: string;
}

// GAP-D158: Modal de payload
function PayloadDialog({ open, onClose, payload }: { open: boolean; onClose: () => void; payload: any }) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> Detalhes do Payload
          </DialogTitle>
          <DialogDescription>Dados completos da ação registrada.</DialogDescription>
        </DialogHeader>
        <pre className="bg-secondary p-4 rounded-lg overflow-x-auto text-xs font-mono whitespace-pre-wrap">
          {JSON.stringify(payload, null, 2)}
        </pre>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// GAP-D155: Função de reversão por tipo
// TODO: os updates abaixo não verificam quantas linhas foram afetadas.
// Um UPDATE que afeta 0 rows retorna success mesmo assim. Adicionar .select()
// após o update pra confirmar.
async function revertAction(
  logId: string,
  action: string,
  entity: string,
  entityId: string,
  reason: string,
  adminId: string
): Promise<boolean> {
  try {
    let success = false;

    switch (action) {
      case 'ban_user':
      case 'denuncia_ban':
      case 'moderacao_ban': {
        // Reverter banimento
        const { error } = await supabase
          .from('profiles')
          .update({ banned_until: null, ban_reason_public: null })
          .eq('id', entityId);
        if (!error) success = true;
        break;
      }

      case 'delete_product':
      case 'delete_catalog_game': {
        // Restaurar produto (marcar como ativo)
        const { error } = await supabase
          .from('produtos')
          .update({ is_active: true, deleted_at: null })
          .eq('id', entityId);
        if (!error) success = true;
        break;
      }

      case 'delete_employee': {
        // Reativar funcionário
        const { error } = await supabase
          .from('user_roles')
          .update({ is_active: true })
          .eq('user_id', entityId);
        if (!error) success = true;
        break;
      }

      case 'excluir_post_forum': {
        // Restaurar post do fórum
        const { error } = await supabase
          .from('forum_posts')
          .update({ is_hidden: false, hidden_at: null })
          .eq('id', entityId);
        if (!error) success = true;
        break;
      }

      case 'hide_review': {
        // Restaurar review
        const { error } = await supabase
          .from('avaliacoes')
          .update({ is_hidden: false })
          .eq('id', entityId);
        if (!error) success = true;
        break;
      }

      case 'remove_screenshot': {
        // Restaurar screenshot (se possível)
        const { error } = await supabase
          .from('game_screenshots')
          .update({ is_hidden: false })
          .eq('id', entityId);
        if (!error) success = true;
        break;
      }

      case 'delete_opinion': {
        // Restaurar opinião
        const { error } = await supabase
          .from('game_opinions')
          .update({ is_hidden: false })
          .eq('id', entityId);
        if (!error) success = true;
        break;
      }

      default: {
        toast.error(`Reversão não suportada para: ${action}`);
        return false;
      }
    }

    if (success) {
      // Registrar a reversão no log
      await dbWrite(
        supabase.from('admin_logs').insert({
          admin_id: adminId,
          action: `revert_${action}`,
          entity: entity,
          entity_id: entityId,
          reason: `Reversão: ${reason}`,
          payload: { original_log_id: logId },
        })
      );

      // Marcar o log original como revertido
      await dbWrite(
        supabase
          .from('admin_logs')
          .update({
            reverted_at: new Date().toISOString(),
            reverted_by: adminId,
            revert_reason: reason,
          })
          .eq('id', logId)
      );

      toast.success('Ação revertida com sucesso!');
      return true;
    }

    toast.error('Erro ao reverter ação');
    return false;
  } catch (error) {
    console.error('Erro na reversão:', error);
    toast.error('Erro ao reverter ação');
    return false;
  }
}

export default function LogsAdministrativos() {
  const { user } = useAuth();
  const isAdminGeral = user?.role === 'admin';

  const [rows, setRows] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // GAP-D156: Filtros
  const [filters, setFilters] = useState<Filters>({
    entity: 'all',
    action: 'all',
    status: 'all',
    from: '',
    to: '',
    search: '',
  });

  // GAP-D158: Payload modal
  const [payloadModal, setPayloadModal] = useState<{ open: boolean; payload: any }>({
    open: false,
    payload: null,
  });

  // GAP-D155: Reversão
  const [revertTarget, setRevertTarget] = useState<LogEntry | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);

  // GAP-D156: Entidades e ações disponíveis
  const entities = useMemo(() => {
    const set = new Set(rows.map(r => r.entity).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const actions = useMemo(() => {
    const set = new Set(rows.map(r => r.action).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  // GAP-D159: Carregar logs
  const loadLogs = async (reset: boolean = false) => {
    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let query = supabase
        .from('admin_logs')
        .select('*, profiles!admin_id(display_name)', { count: 'exact' })
        .order('created_at', { ascending: false });

      // GAP-D156: Aplicar filtros
      if (filters.entity !== 'all') {
        query = query.eq('entity', filters.entity);
      }
      if (filters.action !== 'all') {
        query = query.eq('action', filters.action);
      }
      if (filters.status === 'reverted') {
        query = query.not('reverted_at', 'is', null);
      } else if (filters.status === 'active') {
        query = query.is('reverted_at', null);
      }
      if (filters.from) {
        query = query.gte('created_at', new Date(filters.from).toISOString());
      }
      if (filters.to) {
        query = query.lte('created_at', new Date(filters.to + 'T23:59:59').toISOString());
      }
      if (filters.search) {
        const search = `%${filters.search}%`;
        query = query.or(
          `action.ilike.${search},entity.ilike.${search},entity_id.ilike.${search},reason.ilike.${search}`
        );
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      if (reset) {
        setRows(data || []);
        setTotalCount(count || 0);
      } else {
        setRows(prev => [...prev, ...(data || [])]);
      }

      setHasMore((data || []).length === ITEMS_PER_PAGE);
      setPage(currentPage + 1);
    } catch (error) {
      toast.error('Erro ao carregar logs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadLogs(true);
  }, [filters]);

  // GAP-D157: Exportar CSV
  const exportCSV = () => {
    if (rows.length === 0) {
      toast.info('Nenhum dado para exportar');
      return;
    }

    const headers = ['Data', 'Admin', 'Ação', 'Entidade', 'ID', 'Motivo', 'Status'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r => {
        const status = r.reverted_at ? 'Revertido' : 'Ativo';
        return [
          formatDateTime(r.created_at),
          r.profiles?.display_name || r.admin_id,
          r.action,
          r.entity,
          r.entity_id,
          (r.reason || '').replace(/,/g, ' '),
          status,
        ].join(',');
      }),
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-administrativos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  // GAP-D155: Iniciar reversão
  const handleRevert = (log: LogEntry) => {
    if (!isAdminGeral) {
      toast.error('Apenas administradores gerais podem reverter ações');
      return;
    }
    if (!REVERTIBLE_ACTIONS.has(log.action)) {
      toast.error('Esta ação não pode ser revertida');
      return;
    }
    if (log.reverted_at) {
      toast.info('Esta ação já foi revertida');
      return;
    }
    setRevertTarget(log);
    setRevertReason('');
    setRevertDialogOpen(true);
  };

  // GAP-D155: Confirmar reversão
  const confirmRevert = async () => {
    if (!revertTarget || !user) return;
    if (!revertReason.trim() || revertReason.length < 10) {
      toast.error('Descreva o motivo da reversão (mínimo 10 caracteres)');
      return;
    }

    setReverting(true);
    const success = await revertAction(
      revertTarget.id,
      revertTarget.action,
      revertTarget.entity,
      revertTarget.entity_id,
      revertReason,
      user.id
    );

    setReverting(false);
    setRevertDialogOpen(false);
    setRevertTarget(null);
    setRevertReason('');

    if (success) {
      await loadLogs(true);
    }
  };

  // GAP-D156: Limpar filtros
  const clearFilters = () => {
    setFilters({
      entity: 'all',
      action: 'all',
      status: 'all',
      from: '',
      to: '',
      search: '',
    });
  };

  const activeFiltersCount = [
    filters.entity !== 'all',
    filters.action !== 'all',
    filters.status !== 'all',
    !!filters.from,
    !!filters.to,
    !!filters.search,
  ].filter(Boolean).length;

  // GAP-D156: Status badge
  const getStatusBadge = (log: LogEntry) => {
    if (log.reverted_at) {
      return <Badge variant="outline" className="text-muted-foreground">Revertido</Badge>;
    }
    if (REVERTIBLE_ACTIONS.has(log.action)) {
      return <Badge className="bg-success/10 text-success border-success/30">Ativo · Reversível</Badge>;
    }
    return <Badge className="bg-primary/10 text-primary border-primary/30">Ativo</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Logs Administrativos
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico completo de ações dos administradores. {totalCount} registros no total.
          </p>
        </div>
        {/* GAP-D157: Exportar CSV */}
        <Button onClick={exportCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* GAP-D156: Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="text-xs">{activeFiltersCount} ativos</Badge>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
              Limpar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Entidade */}
          <div>
            <Label className="text-xs text-muted-foreground">Entidade</Label>
            <Select
              value={filters.entity}
              onValueChange={(v) => setFilters(prev => ({ ...prev, entity: v }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {entities.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ação */}
          <div>
            <Label className="text-xs text-muted-foreground">Ação</Label>
            <Select
              value={filters.action}
              onValueChange={(v) => setFilters(prev => ({ ...prev, action: v }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {actions.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters(prev => ({ ...prev, status: v as any }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="reverted">Revertidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Busca */}
          <div>
            <Label className="text-xs text-muted-foreground">Busca</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="ID, ação, motivo..."
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <Card className="border-border/50">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Admin</TableHead>
                <TableHead className="text-xs">Ação</TableHead>
                <TableHead className="text-xs">Entidade</TableHead>
                <TableHead className="text-xs">ID</TableHead>
                <TableHead className="text-xs">Motivo</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((log) => (
                  <TableRow key={log.id} className="border-border hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.profiles?.display_name || log.admin_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{log.action}</TableCell>
                    <TableCell className="text-xs">{log.entity}</TableCell>
                    <TableCell className="text-xs font-mono">{log.entity_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">
                      {log.reason || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(log)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* GAP-D158: Ver payload */}
                        {log.payload && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setPayloadModal({ open: true, payload: log.payload })}
                            title="Ver payload"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {/* GAP-D155: Reverter */}
                        {isAdminGeral &&
                          REVERTIBLE_ACTIONS.has(log.action) &&
                          !log.reverted_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-warning hover:text-warning"
                              onClick={() => handleRevert(log)}
                              title="Reverter ação"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* GAP-D159: Paginação */}
      {hasMore && rows.length > 0 && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            onClick={() => loadLogs(false)}
            disabled={loadingMore}
            className="text-sm"
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-2" />
            )}
            Carregar mais logs
          </Button>
        </div>
      )}

      {/* GAP-D158: Payload Modal */}
      <PayloadDialog
        open={payloadModal.open}
        onClose={() => setPayloadModal({ open: false, payload: null })}
        payload={payloadModal.payload}
      />

      {/* GAP-D155: Revert Dialog */}
      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Reverter ação
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>Você está prestes a reverter a seguinte ação:</p>
                <div className="bg-secondary/50 p-3 rounded-lg text-sm">
                  <p><strong>Ação:</strong> {revertTarget?.action}</p>
                  <p><strong>Entidade:</strong> {revertTarget?.entity}</p>
                  <p><strong>ID:</strong> {revertTarget?.entity_id}</p>
                  {revertTarget?.reason && (
                    <p><strong>Motivo original:</strong> {revertTarget.reason}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta ação será registrada no log de auditoria.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-3">
            <Label className="text-sm font-medium">Motivo da reversão *</Label>
            <Textarea
              value={revertReason}
              onChange={(e) => setRevertReason(e.target.value)}
              placeholder="Explique por que está revertendo esta ação (mínimo 10 caracteres)..."
              rows={3}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {revertReason.length}/10 caracteres
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reverting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevert}
              disabled={reverting || revertReason.length < 10}
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              {reverting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar reversão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}