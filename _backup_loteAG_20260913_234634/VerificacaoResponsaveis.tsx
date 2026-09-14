// ECA Digital: fila de verificação de responsáveis (CPF + telefone + atestado).
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import EstadoVazio from '@/components/EstadoVazio';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminPageHeader } from '@/desktop/components/AdminPageHeader';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ShieldCheck, ShieldX, ExternalLink, ShieldQuestion, Search, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { adminLog } from '../lib/adminLog';
import { Loader2 } from 'lucide-react';

type Row = {
  id: string; minor_id: string; guardian_cpf: string; guardian_phone: string;
  guardian_full_name: string; atestado_url: string; status: string;
  created_at: string; reason: string | null;
};

const ITEMS_PER_PAGE = 20;

export default function VerificacaoResponsaveis() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = (supabase as any)
        .from('guardian_link_requests')
        .select('*', { count: 'exact' })
        .eq('status', tab)
        .order('created_at', { ascending: false });

      if (dateFilter === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        query = query.gte('created_at', today);
      } else if (dateFilter === 'week') {
        const week = new Date();
        week.setDate(week.getDate() - 7);
        query = query.gte('created_at', week.toISOString());
      } else if (dateFilter === 'month') {
        const month = new Date();
        month.setDate(month.getDate() - 30);
        query = query.gte('created_at', month.toISOString());
      }

      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;

      if (reset) {
        setRows((data as Row[]) || []);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setRows(prev => [...prev, ...((data as Row[]) || [])]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast.error('Erro ao carregar pedidos');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  // TODO: `page` está nas deps do useCallback — cada mudança de página recria a função
  // e dispara novo fetch via useEffect. Ideal: separar em dois efeitos.
  }, [tab, dateFilter, page]);

  useEffect(() => { load(true); }, [tab, dateFilter]);

  // GAP-D333: Filtrar por busca
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.guardian_full_name.toLowerCase().includes(q) ||
      r.guardian_cpf.includes(q) ||
      r.guardian_phone.includes(q) ||
      r.minor_id.includes(q)
    );
  }, [rows, search]);

  // GAP-D331: adminLog e GAP-D332: Notificação
  const review = async (id: string, approve: boolean) => {
    const request = rows.find(r => r.id === id);
    if (!request) return;

    const { error } = await (supabase as any).rpc('admin_review_guardian_link', {
      _id: id, _approve: approve, _reason: reason || null,
    });
    if (error) { toast.error(error.message || 'Erro'); return; }

    // GAP-D331: adminLog
    await adminLog({
      action: approve ? 'approve_guardian_link' : 'reject_guardian_link',
      entity: 'guardian_link_requests',
      entity_id: id,
      reason: reason || (approve ? 'Vínculo aprovado' : 'Vínculo rejeitado'),
      payload: {
        minor_id: request.minor_id,
        guardian: request.guardian_full_name,
        cpf: request.guardian_cpf
      }
    });

    // GAP-D332: Notificar menor
    await supabase.from('notifications').insert({
      user_id: request.minor_id,
      type: 'system',
      title: approve ? '✅ Vínculo com responsável aprovado' : '❌ Vínculo com responsável rejeitado',
      body: approve 
        ? 'Seu cadastro foi verificado com sucesso! Você está liberado para usar a plataforma.'
        : `Seu pedido de vínculo foi rejeitado. ${reason ? `Motivo: ${reason}` : 'Entre em contato com o suporte.'}`,
      reference_type: 'guardian_link',
      reference_id: id,
    });

    toast.success(approve ? 'Vínculo aprovado — conta marcada como verificada' : 'Pedido rejeitado — usuário notificado');
    setReason('');
    load(true);
  };

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-4">
      <AdminPageHeader 
        icon={ShieldQuestion} 
        title="Verificação de Responsáveis" 
        subtitle="ECA Digital — Lei 15.211/2025" 
      />

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected'] as const).map(t => (
            <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>
              {t === 'pending' ? 'Pendentes' : t === 'approved' ? 'Aprovados' : 'Rejeitados'}
              <span className="ml-1 text-xs opacity-60">
                ({tab === t ? rows.length : '})
              </span>
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-8" 
            placeholder="Buscar por nome, CPF..." 
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
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mês</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDateFilter('all'); }}>
          Limpar
        </Button>
      </div>

      {!loading && paginated.length === 0 && <EstadoVazio titulo="Nenhum pedido nesta aba" descricao="Solicitações de vínculo com responsável aparecem aqui." />}

      <div className="grid gap-3">
        {paginated.map(r => (
          <div key={r.id} className="border rounded-lg p-4 bg-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <strong>{r.guardian_full_name}</strong>
                <span className="text-muted-foreground ml-2">CPF {r.guardian_cpf} · Tel {r.guardian_phone}</span>
              </div>
              <Badge variant="outline">{formatDateTime(r.created_at)}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">Menor: <code>{r.minor_id}</code></div>
            <a href={r.atestado_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary text-sm hover:underline">
              <ExternalLink className="h-3 w-3" /> Ver atestado
            </a>
            {r.reason && <p className="text-xs text-muted-foreground">Motivo: {r.reason}</p>}

            {tab === 'pending' && (
              <div className="flex gap-2 pt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" className="gap-1"><ShieldCheck className="h-4 w-4" />Aprovar</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Aprovar vínculo de responsável</AlertDialogTitle>
                      <AlertDialogDescription>
                        Confirmo que verifiquei CPF, telefone e atestado. A conta do menor será marcada como verificada.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea 
                      value={reason} 
                      onChange={e => setReason(e.target.value)} 
                      placeholder="Observação (opcional)" 
                      rows={2}
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => review(r.id, true)}>Aprovar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-1"><ShieldX className="h-4 w-4" />Rejeitar</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Rejeitar vínculo</AlertDialogTitle>
                      <AlertDialogDescription>Explique o motivo — o menor será notificado.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea 
                      value={reason} 
                      onChange={e => setReason(e.target.value)} 
                      placeholder="Motivo obrigatório" 
                      rows={2}
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => reason.trim() ? review(r.id, false) : toast.error('Informe o motivo')}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Rejeitar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {tab !== 'pending' && (
              <div className="text-xs text-muted-foreground">
                {tab === 'approved' ? '✅ Aprovado' : '❌ Rejeitado'}
                {r.reason && <span className="ml-2">— {r.reason}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

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
    </div>
  );
}