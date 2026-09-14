import { useEffect, useMemo, useState } from 'react';
import { Zap, Loader2, Plus, Download, Search, ListOrdered, Rows3, ChevronLeft, ChevronRight, Filter, Eye, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog, exportCsv } from '../lib/adminLog';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDateTime } from '@/lib/format';

interface Props { platform: 'mobile' | 'web' }

const MOBILE_ACTIONS = ['forum_post', 'forum_reply', 'tournament_rank_1', 'tournament_rank_2', 'tournament_rank_3', 'tournament_signup'];
const WEB_ACTIONS = ['purchase', 'review'];

const ACTION_LABELS: Record<string, string> = {
  forum_post: '📝 Post no fórum',
  forum_reply: '💬 Resposta no fórum',
  tournament_rank_1: '🏆 1º lugar torneio',
  tournament_rank_2: '🥈 2º lugar torneio',
  tournament_rank_3: '🥉 3º lugar torneio',
  tournament_signup: '📋 Inscrição torneio',
  purchase: '🛒 Compra na loja',
  review: '⭐ Review publicado',
  admin_grant: '👑 Concedido por admin',
};

const ITEMS_PER_PAGE = 30;

export default function XPList({ platform }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: '', xp: '50', reason: '' });
  const [view, setView] = useState<'log' | 'agregado'>('log');
  const [exporting, setExporting] = useState(false);
  const [userNameMap, setUserNameMap] = useState<Map<string, string>>(new Map());

  const actions = platform === 'mobile' ? MOBILE_ACTIONS : WEB_ACTIONS;
  const allActions = [...actions, 'admin_grant'];

  const load = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const fromIdx = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase
        .from('user_xp_log')
        .select('*', { count: 'exact' })
        .in('action', allActions)
        .order('created_at', { ascending: false });

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error, count } = await query.range(fromIdx, fromIdx + ITEMS_PER_PAGE - 1);
      if (error) throw error;

      // Buscar nomes dos usuários
      const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);
        const map = new Map<string, string>();
        (profiles || []).forEach(p => map.set(p.id, p.display_name || 'Usuário'));
        setUserNameMap(map);
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
      toast.error('Erro ao carregar registros de XP');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { load(true); }, [actionFilter]);

  // GAP-D356: Realtime
  useRealtimeRefresh(['user_xp_log'], () => load(true), 'admin-xp');

  // TODO: filtros (search, from, to) rodam client-side sobre rows paginados.
  // TODO: filtro client-side sobre rows paginados.
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      const matchSearch = !q || 
        r.user_id.includes(q) ||
        (r.action || '').toLowerCase().includes(q) ||
        (userNameMap.get(r.user_id) || '').toLowerCase().includes(q);
      const d = new Date(r.created_at);
      const matchFrom = !from || d >= new Date(from);
      const matchTo = !to || d <= new Date(to + 'T23:59:59');
      return matchSearch && matchFrom && matchTo;
    });
  }, [rows, search, from, to, userNameMap]);

  // GAP-D355: Agregado por usuário com nome
  const agregado = useMemo(() => {
    const map = new Map<string, { user_id: string; user_name: string; total: number; eventos: number; ultimo: string }>();
    filtered.forEach(r => {
      const cur = map.get(r.user_id) || { 
        user_id: r.user_id, 
        user_name: userNameMap.get(r.user_id) || r.user_id.slice(0, 8),
        total: 0, 
        eventos: 0, 
        ultimo: r.created_at 
      };
      cur.total += Number(r.xp || 0);
      cur.eventos += 1;
      if (new Date(r.created_at) > new Date(cur.ultimo)) cur.ultimo = r.created_at;
      map.set(r.user_id, cur);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filtered, userNameMap]);

  // GAP-D352: Notificar usuário
  const notifyUser = async (userId: string, title: string, body: string) => {
    if (!userId) return;
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'system',
      title,
      body,
      reference_type: 'xp',
    });
  };

  // GAP-D353: Validar XP
  const grant = async () => {
    const xp = Number(form.xp);
    if (!form.user_id) return toast.error('Informe o User ID');
    // Validar formato UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(form.user_id)) {
      return toast.error('User ID deve ser um UUID válido');
    }
    if (!xp || xp <= 0) return toast.error('XP deve ser maior que 0');
    if (xp > 10000) return toast.error('XP máximo por concessão é 10.000');
    if (form.reason.trim().length < 4) return toast.error('Justificativa obrigatória (mínimo 4 caracteres)');

    const { error } = await supabase.rpc('award_xp' as any, { 
      _user_id: form.user_id, 
      _action: 'admin_grant', 
      _xp: xp, 
      _ref_type: 'admin', 
      _ref_id: null 
    });
    if (error) return toast.error(error.message);

    // GAP-D351: adminLog
    await adminLog({ 
      action: 'xp_grant', 
      entity: 'user_xp_log', 
      entity_id: form.user_id, 
      reason: form.reason, 
      payload: { xp, platform } 
    });

    // GAP-D352: Notificar
    await notifyUser(
      form.user_id,
      `⚡ +${xp} XP concedido!`,
      `Você recebeu ${xp} XP na plataforma ${platform}. Motivo: ${form.reason}`
    );

    toast.success(`+${xp} XP concedido e usuário notificado`);
    setOpen(false); 
    setForm({ user_id: '', xp: '50', reason: '' }); 
    load(true);
  };

  // TODO: usa toast.info com multi-line. Deveria ser um modal dedicado.
  const getAdjustmentHistory = async (userId: string) => {
    const { data } = await supabase
      .from('user_xp_log')
      .select('*')
      .eq('user_id', userId)
      .eq('action', 'admin_grant')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (!data || data.length === 0) {
      toast.info('Nenhum ajuste manual encontrado para este usuário');
      return;
    }

    // Mostrar em um modal simples
    const historyText = data.map(r => 
      `+${r.xp} XP - ${formatDateTime(r.created_at)}`
    ).join('\n');
    
    toast.info(`Histórico de ajustes:\n${historyText}`);
  };

  // GAP-D355: Visualizar referência
  const viewReference = (row: any) => {
    if (!row.reference_type || !row.reference_id) {
      toast.info('Nenhuma referência vinculada');
      return;
    }

    let url = '';
    if (row.reference_type === 'tournament') {
      url = `/desktop/torneios?id=${row.reference_id}`;
    } else if (row.reference_type === 'purchase') {
      url = `/desktop/pedidos?id=${row.reference_id}`;
    } else if (row.reference_type === 'review') {
      url = `/desktop/avaliacoes?id=${row.reference_id}`;
    }

    if (url) {
      window.open(url, '_blank');
    } else {
      toast.info(`Referência: ${row.reference_type} - ${row.reference_id}`);
    }
  };

  const exportData = () => {
    setExporting(true);
    const data = view === 'agregado' 
      ? agregado.map(a => ({
          'ID do Usuário': a.user_id,
          'Nome': a.user_name,
          'XP Total': a.total,
          'Eventos': a.eventos,
          'Último Registro': formatDateTime(a.ultimo),
        }))
      : filtered.map(r => ({
          'ID do Usuário': r.user_id,
          'Nome': userNameMap.get(r.user_id) || r.user_id.slice(0, 8),
          'Ação': ACTION_LABELS[r.action] || r.action,
          'XP': r.xp,
          'Data': formatDateTime(r.created_at),
          'Referência': r.reference_type || '—',
        }));
    exportCsv(`xp_${platform}_${view === 'agregado' ? 'por_usuario' : 'historico'}.csv`, data);
    setExporting(false);
    toast.success('CSV exportado com sucesso');
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader 
        icon={Zap} 
        title={`XP ${platform === 'mobile' ? 'Mobile' : 'Web'}`}
        subtitle={`Distribuição e ajuste manual de XP na plataforma ${platform}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setView(v => v === 'log' ? 'agregado' : 'log')}>
              {view === 'log' ? <><ListOrdered className="h-4 w-4 mr-1" />Ver por usuário</> : <><Rows3 className="h-4 w-4 mr-1" />Ver histórico</>}
            </Button>
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Conceder XP</Button>
          </div>
        } 
      />

      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                className="pl-8" 
                placeholder="Usuário ou ação..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Ação</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {allActions.map(a => (
                  <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>
                ))}
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
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setActionFilter('all'); setFrom(''); setTo(''); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {view === 'agregado' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">XP total</TableHead>
                  <TableHead className="text-center">Eventos</TableHead>
                  <TableHead>Último registro</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agregado.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="p-0"><EstadoVazio titulo="Sem registros" /></TableCell></TableRow>
                ) : agregado.map(a => (
                  <TableRow key={a.user_id} className="border-border hover:bg-muted/30">
                    <TableCell className="font-mono text-xs">{a.user_id.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium">{a.user_name}</TableCell>
                    <TableCell className="text-center font-bold text-primary">+{a.total}</TableCell>
                    <TableCell className="text-center">{a.eventos}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(a.ultimo)}</TableCell>
                    <TableCell className="text-center">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 text-xs"
                        aria-label={`Ver histórico de ajustes de ${a.user_name}`}
                        onClick={() => getAdjustmentHistory(a.user_id)}
                      >
                        <History className="h-3 w-3 mr-1" />Ajustes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="text-center">XP</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="p-0"><EstadoVazio titulo="Sem registros" /></TableCell></TableRow>
                ) : paginated.map((r, i) => (
                  <TableRow key={i} className="border-border hover:bg-muted/30">
                    <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{userNameMap.get(r.user_id) || '—'}</TableCell>
                    <TableCell>{ACTION_LABELS[r.action] || r.action}</TableCell>
                    <TableCell className="text-center font-bold text-primary">+{r.xp}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
                    <TableCell className="text-center">
                      {r.reference_type && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-xs"
                          aria-label={`Ver referência ${r.reference_type || ''} ${r.reference_id || ''}`}
                          onClick={() => viewReference(r)}
                        >
                          <Eye className="h-3 w-3 mr-1" />Ver ref.
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* GAP-D350: Paginação */}
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

      {/* Dialog de concessão */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conceder XP manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>User ID</Label>
              <Input 
                value={form.user_id} 
                onChange={e => setForm({ ...form, user_id: e.target.value })} 
                placeholder="UUID do usuário" 
              />
            </div>
            <div>
              <Label>XP (1-10.000)</Label>
              <Input 
                type="number" 
                min="1" 
                max="10000"
                value={form.xp} 
                onChange={e => setForm({ ...form, xp: e.target.value })} 
              />
            </div>
            <div>
              <Label>Justificativa (mínimo 4 caracteres)</Label>
              <Input 
                value={form.reason} 
                onChange={e => setForm({ ...form, reason: e.target.value })} 
                placeholder="Motivo da concessão" 
              />
            </div>
            <Button onClick={grant} className="w-full">Conceder</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}