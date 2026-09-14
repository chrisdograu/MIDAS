import { useEffect, useMemo, useState } from 'react';
import { 
  AlertTriangle, Loader2, Search, Download, Ban, ShieldAlert, CheckCircle2, 
  XCircle, EyeOff, ExternalLink, User, FileText, Clock, Trash2, 
  Square, CheckSquare, ChevronLeft, ChevronRight, Bell, History 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime, formatDate } from '@/lib/format';

type Action = 'resolve' | 'dismiss' | 'warn' | 'ban' | 'mark_spoiler' | 'delete_content';

const SEVERITY_OPTIONS = ['all', 'low', 'medium', 'high', 'critical'];
const SEVERITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};
const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/15 text-warning',
  high: 'bg-warning/15 text-warning',
  critical: 'bg-destructive/20 text-destructive',
};

const BAN_OPTIONS = [
  { value: '1', label: '1 dia' },
  { value: '3', label: '3 dias' },
  { value: '7', label: '7 dias' },
  { value: '15', label: '15 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '365', label: '1 ano' },
  { value: 'permanent', label: 'Permanente' },
];

function linkParaConteudo(r: any): string | null {
  switch (r.target_type) {
    case 'usuario': return `/perfil/${r.target_id}`;
    case 'forum_post': return `/m/forum/post/${r.target_id}`;
    case 'forum_reply': return `/m/forum/post/${r.target_id}`;
    case 'anuncio': return `/m/marketplace/${r.target_id}`;
    case 'review': return `/m/review/${r.target_id}`;
    case 'review_completa': return `/review/${r.target_id}`;
    case 'grupo': return `/m/grupos/${r.target_id}/info`;
    case 'mensagem':
    case 'conversa': return null;
    default: return null;
  }
}

function getContentPreview(r: any): string | null {
  if (r.content_preview) return r.content_preview;
  if (r.description) return r.description;
  if (r.reason) return r.reason;
  return null;
}

function getTargetUser(r: any): string | null {
  if (r.target_type === 'usuario') return r.target_id;
  if (r.target_user_id) return r.target_user_id;
  return null;
}

export default function Denuncias() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [severity, setSeverity] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [dialog, setDialog] = useState<{ row: any; action: Action } | null>(null);
  const [reason, setReason] = useState('');
  const [banDuration, setBanDuration] = useState('7');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<Action | null>(null);
  const [viewingUser, setViewingUser] = useState<string | null>(null);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [userReports, setUserReports] = useState<any[]>([]);
  const PAGE_SIZE = 20;

  const load = async (append = false) => {
    if (!append) setLoading(true);
    
    let query = supabase
      .from('denuncias')
      .select('*')
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);
    if (type !== 'all') query = query.eq('target_type', type);
    if (severity !== 'all') query = query.eq('severity', severity);
    
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data } = await query;
    const newRows = data || [];
    
    if (append) {
      setRows(prev => [...prev, ...newRows]);
    } else {
      setRows(newRows);
    }
    
    setHasMore(newRows.length === PAGE_SIZE);
    if (!append) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  
  useEffect(() => {
    setPage(0);
    load(false);
  }, [status, type, severity, search]);

  useRealtimeRefresh(['denuncias'], () => load(false), 'admin-denuncias');

  // TODO: o filtro de busca é client-side sobre rows já paginados.
    // Mover para .or() na query server-side pra funcionar com paginação.
    const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    return rows.filter(r => {
      if (!search) return true;
      return (
        (r.reason || '').toLowerCase().includes(searchLower) ||
        (r.description || '').toLowerCase().includes(searchLower) ||
        (r.reporter_name || '').toLowerCase().includes(searchLower) ||
        (r.target_id || '').toLowerCase().includes(searchLower)
      );
    });
  }, [rows, search]);

  // GAP-D98: Carregar histórico do usuário
  const loadUserHistory = async (userId: string) => {
    setViewingUser(userId);
    setLoadingHistory(true);
    
    const [{ data: history }, { data: reports }] = await Promise.all([
      supabase
        .from('moderation_history')
        .select('*')
        .eq('target_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('denuncias')
        .select('*')
        .eq('target_id', userId)
        .eq('target_type', 'usuario')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    
    setUserHistory(history || []);
    setUserReports(reports || []);
    setLoadingHistory(false);
  };

  // GAP-D97: Notificar usuário
  const notifyUser = async (userId: string, title: string, body: string, referenceId?: string) => {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'moderation',
      title,
      body,
      reference_type: 'denuncia',
      reference_id: referenceId,
    });
  };

  // GAP-D96: Ações graduadas
  const apply = async () => {
    if (!dialog) return;
    if (reason.trim().length < 4) return toast.error('Justificativa obrigatória (mínimo 4 caracteres)');
    
    const { row, action } = dialog;
    const { data: { user } } = await supabase.auth.getUser();
    const targetUser = getTargetUser(row);
    const now = new Date().toISOString();

    // GAP-D101: Apagar conteúdo sem punição
    if (action === 'delete_content') {
      const map: Record<string, string> = {
        forum_post: 'forum_posts',
        forum_reply: 'forum_replies',
        review: 'avaliacoes',
        review_completa: 'reviews_completas',
        anuncio: 'anuncios',
      };
      const table = map[row.target_type];
      if (table) {
        const { error } = await supabase.from(table as any).update({ 
          is_hidden: true, 
          hidden_reason: reason 
        } as any).eq('id', row.target_id);
        if (error) return toast.error(error.message);
      }
      
      await supabase.from('denuncias').update({
        status: 'resolved', resolved_by: user?.id, resolved_at: now,
      }).eq('id', row.id);
      
      await adminLog({ 
        action: 'denuncia_delete_content', 
        entity: 'denuncia', 
        entity_id: row.id, 
        reason,
        payload: { target_type: row.target_type, target_id: row.target_id } 
      });
      
      if (targetUser) {
        await notifyUser(
          targetUser,
          'Conteúdo removido por denúncia',
          `Seu conteúdo foi removido após análise da moderação. Motivo: ${reason}`
        );
      }
      
      toast.success('Conteúdo removido');
      setDialog(null); setReason('');
      load(false);
      return;
    }

    // GAP-D96: Ban permanente
    if (action === 'ban' && banDuration === 'permanent') {
      if (!targetUser) return toast.error('Usuário alvo não identificado');
      
      const { error: errBan } = await supabase
        .from('profiles')
        .update({ banned_until: '9999-12-31T23:59:59Z' })
        .eq('id', targetUser);
      if (errBan) return toast.error(errBan.message);
      
      await supabase.from('moderation_history').insert({
        target_user_id: targetUser,
        moderator_id: user?.id,
        action: 'ban_permanent',
        reason,
        reference_type: 'denuncia',
        reference_id: row.id,
      });
      
      await supabase.from('denuncias').update({
        status: 'resolved', resolved_by: user?.id, resolved_at: now,
      }).eq('id', row.id);
      
      await adminLog({
        action: 'denuncia_ban_permanent',
        entity: 'denuncia',
        entity_id: row.id,
        reason,
        payload: { target_user: targetUser },
      });
      
      await notifyUser(
        targetUser,
        'Banimento permanente',
        `Sua conta foi permanentemente banida. Motivo: ${reason}`
      );
      
      toast.success('Usuário banido permanentemente');
      setDialog(null); setReason(''); setBanDuration('7');
      load(false);
      return;
    }

    // Resolver/Descartar
    if (action === 'resolve' || action === 'dismiss') {
      const newStatus = action === 'resolve' ? 'resolved' : 'dismissed';
      const { error } = await supabase.from('denuncias').update({
        status: newStatus, resolved_by: user?.id, resolved_at: now,
      }).eq('id', row.id);
      if (error) return toast.error(error.message);
      
      await adminLog({
        action: `denuncia_${action}`,
        entity: 'denuncia',
        entity_id: row.id,
        reason,
        payload: { target_type: row.target_type, target_id: row.target_id },
      });
      
      toast.success(action === 'resolve' ? 'Denúncia resolvida' : 'Denúncia descartada');
      setDialog(null); setReason('');
      load(false);
      return;
    }

    // Mark spoiler
    if (action === 'mark_spoiler') {
      const map: Record<string, string> = { 
        forum_post: 'forum_posts', 
        review: 'avaliacoes',
        review_completa: 'reviews_completas',
      };
      const table = map[row.target_type];
      if (!table) return toast.error('Marcar spoiler só suportado em post de fórum, review ou review completa');
      
      const { error } = await supabase.from(table as any).update({ 
        is_spoiler: true 
      } as any).eq('id', row.target_id);
      if (error) return toast.error(error.message);
      
      await supabase.from('denuncias').update({
        status: 'resolved', resolved_by: user?.id, resolved_at: now,
      }).eq('id', row.id);
      
      await adminLog({
        action: 'denuncia_mark_spoiler',
        entity: 'denuncia',
        entity_id: row.id,
        reason,
        payload: { target_type: row.target_type, target_id: row.target_id },
      });
      
      toast.success('Conteúdo marcado como spoiler');
      setDialog(null); setReason('');
      load(false);
      return;
    }

    // Warn ou Ban (temporário)
    if (action === 'warn' || action === 'ban') {
      if (!targetUser) return toast.error('Usuário alvo não identificado');
      
      const duration = action === 'ban' ? Number(banDuration) || 7 : null;
      
      await supabase.from('moderation_history').insert({
        target_user_id: targetUser,
        moderator_id: user?.id,
        action,
        duration_days: duration,
        reason,
        reference_type: 'denuncia',
        reference_id: row.id,
      });

      if (action === 'ban' && duration) {
        const until = new Date();
        until.setDate(until.getDate() + duration);
        const { error: errBan } = await supabase
          .from('profiles')
          .update({ banned_until: until.toISOString() })
          .eq('id', targetUser);
        if (errBan) return toast.error(errBan.message);
        
        await notifyUser(
          targetUser,
          `Banimento de ${duration} dias`,
          `Sua conta foi temporariamente banida por ${duration} dias. Motivo: ${reason}`
        );
      } else if (action === 'warn') {
        await notifyUser(
          targetUser,
          'Advertência da moderação',
          `Você recebeu uma advertência. Motivo: ${reason}`
        );
      }

      await supabase.from('denuncias').update({
        status: 'resolved', resolved_by: user?.id, resolved_at: now,
      }).eq('id', row.id);
      
      await adminLog({
        action: `denuncia_${action}`,
        entity: 'denuncia',
        entity_id: row.id,
        reason,
        payload: { 
          target_user: targetUser, 
          duration_days: duration,
          ban_type: banDuration === 'permanent' ? 'permanent' : 'temporary',
        },
      });
      
      toast.success(action === 'warn' ? 'Advertência aplicada' : 'Banimento aplicado');
      setDialog(null); setReason(''); setBanDuration('7');
      load(false);
    }
  };

  // GAP-D105: Ação em lote
  const applyBatch = async () => {
    if (!batchAction || selectedIds.size === 0) return;
    if (reason.trim().length < 4) return toast.error('Justificativa obrigatória');
    
    const { data: { user } } = await supabase.auth.getUser();
    const ids = Array.from(selectedIds);
    const now = new Date().toISOString();
    
    // Para ações em lote, apenas resolver/descartar são suportadas
    const newStatus = batchAction === 'resolve' ? 'resolved' : 'dismissed';
    // Só atualiza denúncias ainda pendentes
    const { error } = await supabase
      .from('denuncias')
      .update({ status: newStatus, resolved_by: user?.id, resolved_at: now })
      .in('id', ids)
      .eq('status', 'pending');
    
    if (error) return toast.error(error.message);
    
    await adminLog({
      action: `batch_denuncia_${batchAction}`,
      entity: 'denuncia',
      entity_id: ids.join(','),
      reason,
      payload: { quantidade: ids.length },
    });
    
    toast.success(`${ids.length} denúncias ${batchAction === 'resolve' ? 'resolvidas' : 'descartadas'}`);
    setBatchAction(null);
    setSelectedIds(new Set());
    setReason('');
    load(false);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  // GAP-D106: Exportar com detalhes
  const exportDetailed = () => {
    const data = filtered.map(r => ({
      id: r.id,
      tipo: r.target_type,
      motivo: r.reason,
      descricao: r.description || '',
      status: r.status,
      severidade: SEVERITY_LABELS[r.severity] || r.severity,
      reporter: r.reporter_name || '',
      criado_em: formatDateTime(r.created_at),
      resolvido_em: r.resolved_at ? formatDateTime(r.resolved_at) : '',
    }));
    exportCsv('denuncias_detalhadas.csv', data);
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader 
        icon={AlertTriangle} 
        title="Denúncias" 
        subtitle="Moderação com ações registradas em log"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportDetailed}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
          </div>
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
                placeholder="Motivo, descrição ou ID..." 
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
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="resolved">Resolvidas</SelectItem>
                <SelectItem value="dismissed">Descartadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {['usuario','review','review_completa','forum_post','forum_reply','mensagem','conversa','anuncio','grupo'].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Severidade</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{s === 'all' ? 'Todas' : SEVERITY_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <span className="text-sm font-semibold">{selectedIds.size} selecionadas</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setBatchAction('resolve')}>Resolver</Button>
            <Button variant="outline" size="sm" onClick={() => setBatchAction('dismiss')}>Descartar</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
          </div>
          {batchAction && (
            <div className="flex items-center gap-2 ml-2">
              <Input 
                placeholder="Justificativa..." 
                value={reason} 
                onChange={e => setReason(e.target.value)} 
                className="w-48 h-8 text-sm"
              />
              <Button size="sm" onClick={applyBatch}>Confirmar</Button>
              <Button variant="ghost" size="sm" onClick={() => setBatchAction(null)}>Cancelar</Button>
            </div>
          )}
        </div>
      )}

      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <button aria-label="Selecionar todas as denúncias" onClick={toggleSelectAll} className="text-muted-foreground">
                      {selectedIds.size === filtered.length && filtered.length > 0 ? 
                        <CheckSquare className="h-4 w-4" /> : 
                        <Square className="h-4 w-4" />
                      }
                    </button>
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-center">Severidade</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="p-0">
                    <EstadoVazio titulo="Nenhuma denúncia" />
                  </TableCell></TableRow>
                ) : filtered.map(r => {
                  const isPending = r.status === 'pending';
                  const targetUser = getTargetUser(r);
                  return (
                    <TableRow key={r.id} className={isPending ? 'bg-warning/5' : ''}>
                      <TableCell>
                        <button aria-label={`Selecionar denúncia ${r.id.slice(0, 8)}`} onClick={() => toggleSelect(r.id)} className="text-muted-foreground">
                          {selectedIds.has(r.id) ? 
                            <CheckSquare className="h-4 w-4 text-primary" /> : 
                            <Square className="h-4 w-4" />
                          }
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="text-[10px]">{r.target_type}</Badge>
                          {linkParaConteudo(r) && (
                            <a href={linkParaConteudo(r)!} target="_blank" rel="noreferrer" 
                               className="text-xs text-primary hover:underline flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> Ver conteúdo
                            </a>
                          )}
                          {targetUser && (
                            <button 
                              onClick={() => loadUserHistory(targetUser)}
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              <History className="h-3 w-3" /> Histórico
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={r.reason}>
                        {r.reason}
                        {r.description && (
                          <span className="text-xs text-muted-foreground block truncate" title={r.description}>
                            {r.description}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={SEVERITY_COLORS[r.severity] || 'bg-muted'}>
                          {SEVERITY_LABELS[r.severity] || r.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={isPending ? 'destructive' : 'secondary'}>
                          {isPending ? 'Pendente' : r.status === 'resolved' ? 'Resolvida' : 'Descartada'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {isPending && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => { setDialog({ row: r, action: 'resolve' }); }}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Resolver
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setDialog({ row: r, action: 'dismiss' }); }}>
                              <XCircle className="h-3.5 w-3.5 mr-1" />Descartar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setDialog({ row: r, action: 'delete_content' }); }}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" />Apagar
                            </Button>
                            {(r.target_type === 'forum_post' || r.target_type === 'review' || r.target_type === 'review_completa') && (
                              <Button size="sm" variant="outline" onClick={() => { setDialog({ row: r, action: 'mark_spoiler' }); }}>
                                <EyeOff className="h-3.5 w-3.5 mr-1" />Spoiler
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => { setDialog({ row: r, action: 'warn' }); }}>
                              <ShieldAlert className="h-3.5 w-3.5 mr-1" />Advertir
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setDialog({ row: r, action: 'ban' }); }}>
                              <Ban className="h-3.5 w-3.5 mr-1" />Banir
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filtered.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length}` : '0 resultados'}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => { setPage(p => p - 1); load(false); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs flex items-center px-2">
            {page + 1} / {totalPages || 1}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => { setPage(p => p + 1); load(false); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* GAP-D95/96/97: Dialog de ação com preview do conteúdo */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Ação: {dialog?.action === 'resolve' ? 'Resolver' : 
                     dialog?.action === 'dismiss' ? 'Descartar' :
                     dialog?.action === 'delete_content' ? 'Apagar conteúdo' :
                     dialog?.action === 'mark_spoiler' ? 'Marcar spoiler' :
                     dialog?.action === 'warn' ? 'Advertir' :
                     dialog?.action === 'ban' ? 'Banir' : dialog?.action}
            </DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-4">
              {/* GAP-D95: Preview do conteúdo */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Conteúdo denunciado</p>
                <p className="text-sm">{getContentPreview(dialog.row) || 'Sem preview disponível'}</p>
                {dialog.row.target_type && (
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {dialog.row.target_type}
                  </Badge>
                )}
                {getTargetUser(dialog.row) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Usuário: <code>{getTargetUser(dialog.row)}</code>
                  </p>
                )}
              </div>

              <div>
                <Label>Justificativa <span className="text-destructive">*</span></Label>
                <Textarea 
                  rows={3} 
                  value={reason} 
                  onChange={e => setReason(e.target.value)} 
                  placeholder="Descreva a ação e o motivo (mín. 4 caracteres)" 
                />
              </div>

              {dialog.action === 'ban' && (
                <div>
                  <Label>Duração do banimento</Label>
                  <Select value={banDuration} onValueChange={setBanDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BAN_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {dialog.action === 'warn' && (
                <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
                  <p className="text-xs text-warning">⚠️ O usuário receberá uma notificação de advertência</p>
                </div>
              )}

              {dialog.action === 'ban' && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                  <p className="text-xs text-destructive">⚠️ O usuário será notificado e bloqueado da plataforma</p>
                </div>
              )}

              <Button onClick={apply} className="w-full">
                Aplicar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* GAP-D98: Histórico do usuário */}
      <Dialog open={!!viewingUser} onOpenChange={(o) => !o && setViewingUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Histórico do Usuário
            </DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Tabs defaultValue="history">
              <TabsList>
                <TabsTrigger value="history">Moderação ({userHistory.length})</TabsTrigger>
                <TabsTrigger value="reports">Denúncias ({userReports.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="history" className="mt-2 max-h-[400px] overflow-y-auto">
                {userHistory.length === 0 ? (
                  <EstadoVazio titulo="Sem histórico de moderação" />
                ) : (
                  <div className="space-y-2">
                    {userHistory.map(h => (
                      <div key={h.id} className="p-3 border border-border rounded-lg">
                        <div className="flex items-center justify-between">
                          <Badge className={h.action === 'ban' ? 'bg-destructive/15 text-destructive' : 
                                         h.action === 'warn' ? 'bg-warning/15 text-warning' : 
                                         'bg-muted'}>
                            {h.action}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
                        </div>
                        <p className="text-sm mt-1">{h.reason}</p>
                        {h.duration_days && (
                          <p className="text-xs text-muted-foreground mt-1">Duração: {h.duration_days} dias</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="reports" className="mt-2 max-h-[400px] overflow-y-auto">
                {userReports.length === 0 ? (
                  <EstadoVazio titulo="Nenhuma denúncia contra este usuário" />
                ) : (
                  <div className="space-y-2">
                    {userReports.map(r => (
                      <div key={r.id} className="p-3 border border-border rounded-lg">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{r.target_type}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                        </div>
                        <p className="text-sm mt-1">{r.reason}</p>
                        <p className="text-xs text-muted-foreground">Status: {r.status}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* GAP-D105: Batch action dialog */}
      <Dialog open={!!batchAction && !dialog} onOpenChange={(o) => !o && setBatchAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ação em lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Você está prestes a {batchAction === 'resolve' ? 'resolver' : 'descartar'} <b>{selectedIds.size}</b> denúncias.
            </p>
            <div>
              <Label>Justificativa</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Motivo da ação em lote" rows={3} />
            </div>
            <Button onClick={applyBatch} className="w-full">Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}