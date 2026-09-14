// ECA Digital: fila de revisão humana dos alertas de IA em chats de menores.
// Regra: nunca bloquear automaticamente — sempre humano decide.
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import EstadoVazio from '@/components/EstadoVazio';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminPageHeader } from '@/desktop/components/AdminPageHeader';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Check, AlertTriangle, ShieldAlert, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { Loader2 } from 'lucide-react';

type Row = {
  id: string; kind: string; severity: 'low' | 'medium' | 'high' | 'critical';
  snippet: string | null; status: string; minor_id: string; peer_id: string | null;
  conversation_id: string | null; created_at: string; action_taken: string | null;
};

const SEVERITY_OPTIONS = ['all', 'low', 'medium', 'high', 'critical'];
const KIND_OPTIONS = ['all', 'inappropriate_language', 'personal_info', 'harassment', 'grooming', 'other'];

const sevTone: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/15 text-warning',
  high: 'bg-warning/15 text-warning',
  critical: 'bg-destructive/20 text-destructive',
};

const sevLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

const kindLabels: Record<string, string> = {
  inappropriate_language: 'Linguagem inapropriada',
  personal_info: 'Informação pessoal',
  harassment: 'Assédio',
  grooming: 'Aliciamento',
  other: 'Outro',
};

export default function ChatAlertsQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<'pending' | 'reviewed_safe' | 'reviewed_action'>('pending');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 20;

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    let query = (supabase as any)
      .from('chat_ai_alerts')
      .select('*')
      .eq('status', tab)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false });

    // GAP-D80: Filtros
    if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
    if (kindFilter !== 'all') query = query.eq('kind', kindFilter);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data } = await query;
    const newRows = (data as Row[]) || [];
    
    if (append) {
      setRows(prev => [...prev, ...newRows]);
    } else {
      setRows(newRows);
    }
    
    setHasMore(newRows.length === PAGE_SIZE);
    if (append) setLoadingMore(false);
    else setLoading(false);
  }, [tab, severityFilter, kindFilter, page]);

  // Resetar pagina quando filtros mudam (dispara o load via dependencia)
  useEffect(() => {
    setPage(0);
  }, [tab, severityFilter, kindFilter]);

  useEffect(() => { load(); }, [load]);

  useRealtimeRefresh(['chat_ai_alerts'], () => load(false), 'admin-chat-alerts');

  // GAP-D81: Carregar mais
  const loadMore = () => {
    setPage(prev => prev + 1);
    load(true);
  };

  const review = async (id: string, safe: boolean) => {
    const { error } = await (supabase as any).rpc('review_chat_ai_alert', {
      _id: id, _safe: safe, _action: action || (safe ? 'sem-acao' : 'acao-tomada'),
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Revisado');
    setAction('');
    load(false);
  };

  const filteredCounts = useMemo(() => {
    const pending = rows.filter(r => r.status === 'pending').length;
    const reviewed = rows.filter(r => r.status === 'reviewed_safe').length;
    const actioned = rows.filter(r => r.status === 'reviewed_action').length;
    return { pending, reviewed, actioned };
  }, [rows]);

  if (loading && page === 0) {
    return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-4">
      <AdminPageHeader
        icon={ShieldAlert}
        title="Fila de Alertas de IA — Chat de Menor"
        subtitle="Nenhuma mensagem é bloqueada sem revisão humana."
        actions={
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">Pendentes: {filteredCounts.pending}</Badge>
            <Badge variant="outline" className="text-xs text-success">OK: {filteredCounts.reviewed}</Badge>
            <Badge variant="outline" className="text-xs text-warning">Ações: {filteredCounts.actioned}</Badge>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {(['pending', 'reviewed_safe', 'reviewed_action'] as const).map((t) => (
            <Button 
              key={t} 
              size="sm" 
              variant={tab === t ? 'default' : 'outline'} 
              onClick={() => setTab(t)}
            >
              {t === 'pending' && 'Pendentes'}
              {t === 'reviewed_safe' && 'Revisadas OK'}
              {t === 'reviewed_action' && 'Ação tomada'}
            </Button>
          ))}
        </div>

        {/* GAP-D80: Filtros */}
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            {SEVERITY_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s === 'all' ? 'Todas' : sevLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map(k => (
              <SelectItem key={k} value={k}>{k === 'all' ? 'Todos' : kindLabels[k] || k}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 && (
        <EstadoVazio 
          titulo="Nenhum alerta nesta fila" 
          descricao="Mensagens sinalizadas pela triagem automática aparecem aqui." 
        />
      )}

      <div className="grid gap-3">
        {rows.map(r => (
          <div key={r.id} className="border rounded-lg p-4 bg-card space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={sevTone[r.severity]}>
                  {sevLabels[r.severity] || r.severity}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {kindLabels[r.kind] || r.kind}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {r.status === 'pending' ? '⏳ Pendente' : r.status === 'reviewed_safe' ? '✅ Seguro' : '⚡ Ação tomada'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
            </div>
            {r.snippet && (
              <blockquote className="text-sm bg-muted/30 p-2 rounded border-l-2 border-primary">
                "{r.snippet}"
              </blockquote>
            )}
            <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
              <span>Menor: <code className="bg-muted px-1 rounded">{r.minor_id}</code></span>
              {r.peer_id && <span>Peer: <code className="bg-muted px-1 rounded">{r.peer_id}</code></span>}
              {r.conversation_id && <span>Conv: <code className="bg-muted px-1 rounded">{r.conversation_id.slice(0, 8)}</code></span>}
            </div>
            {r.action_taken && <p className="text-xs text-warning">Ação: <strong>{r.action_taken}</strong></p>}

            {tab === 'pending' && (
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => review(r.id, true)}>
                  <Check className="h-4 w-4" />Marcar seguro
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-1">
                      <AlertTriangle className="h-4 w-4" />Tomar ação
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Registrar ação de moderação</AlertDialogTitle>
                      <AlertDialogDescription>
                        Descreva a ação tomada (avisou responsável, silenciou peer, escalou para admin, etc).
                        Bloqueios de conta seguem pela Moderação normal — aqui só registra a decisão sobre o alerta.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea 
                      value={action} 
                      onChange={e => setAction(e.target.value)} 
                      placeholder="Ação tomada (ex: alerta enviado ao responsável)" 
                      rows={3}
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => action.trim() ? review(r.id, false) : toast.error('Descreva a ação')}>
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* GAP-D81: Carregar mais */}
      {rows.length > 0 && hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            Carregar mais alertas
          </Button>
        </div>
      )}

      {!hasMore && rows.length > 0 && (
        <p className="text-center text-xs text-muted-foreground pt-2">
          {rows.length} alertas carregados — todos os registros foram exibidos
        </p>
      )}
    </div>
  );
}