import { useState, useEffect, useMemo } from 'react';
import { Shield, AlertTriangle, Ban, CheckCircle, Flag, Loader2, UserX, Eye, XCircle, History, Trash2, Infinity as InfinityIcon, Search, Filter, Download, Clock, Users, Calendar, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ContentExplorer from '../components/ContentExplorer';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate, formatDateTime } from '@/lib/format';
import { adminLog } from '../lib/adminLog';

type TargetType = 'anuncio' | 'forum_post' | 'profile' | 'usuario' | 'mensagem'
  | 'reviews_completas' | 'game_opinions' | 'game_screenshots' | 'game_clips' | 'avaliacoes'
  | 'forum_replies' | string;

interface Denuncia {
  id: string; target_type: TargetType; target_id: string; reporter_id: string;
  reason: string; description: string | null; status: string; created_at: string;
  reporter_name: string;
  target_label: string;
  target_author_id: string | null;
}

interface BannedUser { id: string; display_name: string | null; banned_until: string }
interface HistoryRow {
  id: string; target_user_id: string; moderator_id: string; action: string;
  duration_days: number | null; reason: string | null; reference_type: string | null;
  reference_id: string | null; created_at: string;
  target_name: string; moderator_name: string;
}

const TARGET_CONFIG: Record<string, { label: string; table: string; select: string; titleField: string; authorField: string; canDelete: boolean }> = {
  anuncio:            { label: 'Anúncio',        table: 'anuncios',           select: 'title, description, price, status, seller_id', titleField: 'title',   authorField: 'seller_id', canDelete: true },
  forum_post:         { label: 'Post do Fórum',  table: 'forum_posts',        select: 'title, content, user_id',                        titleField: 'title',   authorField: 'user_id',   canDelete: true },
  forum_replies:      { label: 'Resposta Fórum', table: 'forum_replies',      select: 'content, user_id',                               titleField: 'content', authorField: 'user_id',   canDelete: true },
  // comentario_forum removido — usa forum_replies
  profile:            { label: 'Usuário',        table: 'profiles',           select: 'display_name, bio, banned_until',                titleField: 'display_name', authorField: 'id',   canDelete: false },
  usuario:            { label: 'Usuário',        table: 'profiles',           select: 'display_name, bio, banned_until',                titleField: 'display_name', authorField: 'id',   canDelete: false },
  mensagem:           { label: 'Mensagem',       table: 'mensagens',          select: 'content, sender_id',                             titleField: 'content', authorField: 'sender_id', canDelete: true },
  reviews_completas:  { label: 'Review Longa',   table: 'reviews_completas',  select: 'title, content, user_id',                        titleField: 'title',   authorField: 'user_id',   canDelete: true },
  avaliacoes:         { label: 'Avaliação',      table: 'avaliacoes',         select: 'comment, rating, user_id',                       titleField: 'comment', authorField: 'user_id',   canDelete: true },
  game_opinions:      { label: 'Opinião',        table: 'game_opinions',      select: 'text, user_id',                                  titleField: 'text',    authorField: 'user_id',   canDelete: true },
  game_screenshots:   { label: 'Screenshot',     table: 'game_screenshots',   select: 'caption, user_id',                               titleField: 'caption', authorField: 'user_id',   canDelete: true },
  game_clips:         { label: 'Clip',           table: 'game_clips',         select: 'title, user_id',                                 titleField: 'title',   authorField: 'user_id',   canDelete: true },
  grupo:              { label: 'Grupo',           table: 'groups',             select: 'name, description, owner_id, is_disabled',       titleField: 'name',    authorField: 'owner_id',  canDelete: false },
};

const targetTypeLabel = (t: TargetType) => TARGET_CONFIG[t]?.label || t;

const statusBadgeClass = (s: string) =>
  s === 'pending' ? 'bg-warning/20 text-warning'
  : s === 'resolved' ? 'bg-success/20 text-success'
  : 'bg-muted text-muted-foreground';

const statusLabel = (s: string) =>
  s === 'pending' ? 'Pendente' : s === 'resolved' ? 'Resolvida' : 'Improcedente';

const actionLabel = (a: string) => ({
  ban_temp: 'Ban temporário', ban_permanent: 'Ban permanente', unban: 'Desbanido',
  delete_content: 'Conteúdo removido', warning: 'Advertência', dismiss: 'Improcedente', resolve: 'Resolvida',
} as Record<string, string>)[a] || a;

const actionColor = (a: string) =>
  a === 'ban_permanent' ? 'bg-destructive/20 text-destructive'
  : a === 'ban_temp' ? 'bg-warning/20 text-warning'
  : a === 'unban' ? 'bg-success/20 text-success'
  : a === 'delete_content' ? 'bg-accent/20 text-accent'
  : 'bg-muted text-muted-foreground';

const PERMANENT_BAN_DATE = '2999-12-31T23:59:59Z';
const ITEMS_PER_PAGE = 30;

export default function Moderacao() {
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [banned, setBanned] = useState<BannedUser[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [banDialog, setBanDialog] = useState<{ open: boolean; userId: string | null; userName: string; permanent: boolean }>({ open: false, userId: null, userName: '', permanent: false });
  const [banDays, setBanDays] = useState('7');
  const [banReason, setBanReason] = useState('');
  const [detail, setDetail] = useState<Denuncia | null>(null);
  const [detailContent, setDetailContent] = useState<string>('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const { toast } = useToast();

  // GAP-D176: Filtros
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const logModeration = async (target_user_id: string, action: string, opts: { duration_days?: number | null; reason?: string | null; reference_type?: string | null; reference_id?: string | null } = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase.from('moderation_history' as any) as any).insert({
      target_user_id, moderator_id: user.id, action,
      duration_days: opts.duration_days ?? null, reason: opts.reason ?? null,
      reference_type: opts.reference_type ?? null, reference_id: opts.reference_id ?? null,
    });
    // Notificar usuário
    const { error: err } = await supabase.from('notifications').insert({
      user_id: target_user_id, type: 'nova_mensagem',
      title: action === 'ban_permanent' ? 'Sua conta foi banida permanentemente'
        : action === 'ban_temp' ? `Você foi banido por ${opts.duration_days} dias`
        : action === 'unban' ? 'Seu banimento foi removido'
        : action === 'delete_content' ? 'Conteúdo seu foi removido' : 'Ação de moderação',
      body: opts.reason || null,
      reference_type: 'moderacao',
    });
    if (err) { toast({ title: 'Erro na operação', description: err.message, variant: 'destructive' }); }
  };

  const fetchAll = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase
        .from('denuncias')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // GAP-D176: Filtro por tipo
      if (typeFilter !== 'all') {
        query = query.eq('target_type', typeFilter);
      }
      // GAP-D177: Filtro por status
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      // GAP-D186: Filtro por data
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

      // Buscar dados adicionais
      const reporterIds = [...new Set((data || []).map(d => d.reporter_id))];
      const idsByType = new Map<string, string[]>();
      (data || []).forEach(d => {
        if (!TARGET_CONFIG[d.target_type]) return;
        const arr = idsByType.get(d.target_type) || [];
        arr.push(d.target_id);
        idsByType.set(d.target_type, arr);
      });

      const profileTargetIds = [...(idsByType.get('profile') || []), ...(idsByType.get('usuario') || [])];
      const allProfileIds = [...new Set([...reporterIds, ...profileTargetIds])];

      const rowMaps = new Map<string, Map<string, any>>();
      const [profilesRes, ...typeResults] = await Promise.all([
        allProfileIds.length ? supabase.from('profiles').select('id, display_name').in('id', allProfileIds) : Promise.resolve({ data: [] as any[] }),
        ...Array.from(idsByType.entries()).map(async ([type, ids]) => {
          const cfg = TARGET_CONFIG[type];
          if (!cfg || !ids.length) return { type, data: [] as any[] };
          const { data } = await (supabase as any).from(cfg.table).select(`id, ${cfg.select}`).in('id', ids);
          return { type, data: (data as any[]) || [] };
        }),
      ]);

      typeResults.forEach(r => {
        rowMaps.set(r.type, new Map<string, any>(r.data.map((x: any) => [x.id, x])));
      });
      const profileMap = new Map<string, string>((profilesRes.data || []).map((p: any) => [p.id, p.display_name || 'Usuário']));

      const enriched = (data || []).map(d => {
        const cfg = TARGET_CONFIG[d.target_type];
        let target_label = d.target_id.slice(0, 8);
        let target_author_id: string | null = null;
        if (cfg) {
          const row = rowMaps.get(d.target_type)?.get(d.target_id);
          if (row) {
            const raw = row[cfg.titleField];
            target_label = typeof raw === 'string' ? raw.slice(0, 80) : (raw ? String(raw) : target_label);
            target_author_id = row[cfg.authorField] || null;
            if (d.target_type === 'profile' || d.target_type === 'usuario') {
              target_label = profileMap.get(d.target_id) || target_label;
            }
          }
        }
        return { ...d, reporter_name: profileMap.get(d.reporter_id) || 'Usuário', target_label, target_author_id };
      });

      if (reset) {
        setDenuncias(enriched);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setDenuncias(prev => [...prev, ...enriched]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      toast({ title: 'Erro ao carregar denúncias', variant: 'destructive' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Carregar banidos e histórico
  const loadBannedAndHistory = async () => {
    const [{ data: bannedData }, { data: histData }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, banned_until').not('banned_until', 'is', null),
      (supabase.from('moderation_history' as any) as any).select('*').order('created_at', { ascending: false }).limit(500),
    ]);

    if (bannedData) {
      setBanned(bannedData.filter(b => b.banned_until && new Date(b.banned_until) > new Date()) as BannedUser[]);
    }

    if (histData?.length) {
      const ids = new Set<string>();
      (histData as any[]).forEach((h: any) => { ids.add(h.target_user_id); ids.add(h.moderator_id); });
      const { data: profs } = ids.size ? await supabase.from('profiles').select('id, display_name').in('id', [...ids]) : { data: [] as any[] };
      const m = new Map<string, string>((profs || []).map((p: any) => [p.id, p.display_name || 'Usuário']));
      setHistory((histData as any[]).map((h: any) => ({ ...h, target_name: m.get(h.target_user_id) || '—', moderator_name: m.get(h.moderator_id) || '—' })));
    } else setHistory([]);
  };

  useEffect(() => {
    Promise.all([fetchAll(true), loadBannedAndHistory()]);
  }, []);

  // GAP-D189: Realtime
  useRealtimeRefresh(['denuncias', 'moderation_history'], () => {
    fetchAll(true);
    loadBannedAndHistory();
  }, 'admin-moderacao');

  // GAP-D187: Estatísticas por tipo
  // TODO: filtro de busca é client-side sobre denúncias já paginadas.
  // Mover pra .or() na query server-side.
  const typeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    denuncias.forEach(d => {
      stats[d.target_type] = (stats[d.target_type] || 0) + 1;
    });
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [denuncias]);

  const handleResolve = async (d: Denuncia) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: errRes } = await supabase.from('denuncias').update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user?.id || null }).eq('id', d.id);
    if (errRes) { toast({ title: 'Erro ao resolver', description: errRes.message, variant: 'destructive' }); return; }
    await adminLog({
      action: 'resolve_report', entity: 'denuncias', entity_id: d.id,
      reason: d.reason || 'Denúncia resolvida',
      payload: { tipo: d.target_type, alvo: d.target_id, antes: { status: d.status }, depois: { status: 'resolved' } },
    });
    toast({ title: 'Denúncia resolvida' });
    setDetail(null); fetchAll(true);
  };

  const handleDismiss = async (d: Denuncia) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('denuncias').update({ status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: user?.id || null }).eq('id', d.id);
    if (err) { toast({ title: 'Erro na operação', description: err.message, variant: 'destructive' }); return; }
    await adminLog({
      action: 'dismiss_report', entity: 'denuncias', entity_id: d.id,
      reason: d.reason || 'Denúncia improcedente',
      payload: { tipo: d.target_type, alvo: d.target_id, antes: { status: d.status }, depois: { status: 'dismissed' } },
    });
    toast({ title: 'Denúncia marcada como improcedente' });
    setDetail(null); fetchAll(true);
  };

  const handleDeleteContent = async (d: Denuncia) => {
    // TODO: trocar confirm() nativo por AlertDialog.
    if (!confirm('Tem certeza? Esta ação é irreversível.')) return;
    const cfg = TARGET_CONFIG[d.target_type];
    if (!cfg || !cfg.canDelete) {
      toast({ title: 'Este tipo de conteúdo não pode ser removido por aqui', variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).from(cfg.table).delete().eq('id', d.target_id);
    if (error) { toast({ title: 'Erro ao remover conteúdo', description: error.message, variant: 'destructive' }); return; }
    if (d.target_author_id) await logModeration(d.target_author_id, 'delete_content', { reason: d.reason, reference_type: d.target_type, reference_id: d.target_id });
    await adminLog({
      action: 'delete_reported_content', entity: cfg.table, entity_id: d.target_id,
      reason: d.reason || 'Conteúdo removido por moderação',
      payload: { tipo: d.target_type, denuncia_id: d.id, autor: d.target_author_id ?? null },
    });
    await handleResolve(d);
    toast({ title: 'Conteúdo removido' });
  };

  const openBanDialog = (userId: string | null, label: string, permanent = false) => {
    if (!userId) { toast({ title: 'Não foi possível identificar o autor', variant: 'destructive' }); return; }
    setBanDialog({ open: true, userId, userName: label, permanent });
    setBanDays('7'); setBanReason(detail?.reason || '');
  };

  const confirmBan = async () => {
    if (!banDialog.userId) return;
    let until: string;
    let days: number | null = null;
    if (banDialog.permanent) until = PERMANENT_BAN_DATE;
    else {
      days = Number(banDays);
      if (!days || days < 1) { toast({ title: 'Informe um número válido de dias', variant: 'destructive' }); return; }
      until = new Date(Date.now() + days * 86400000).toISOString();
    }
    const { error } = await supabase.from('profiles').update({ banned_until: until }).eq('id', banDialog.userId);
    if (error) { toast({ title: 'Erro ao banir', description: error.message, variant: 'destructive' }); return; }
    await logModeration(banDialog.userId, banDialog.permanent ? 'ban_permanent' : 'ban_temp', { duration_days: days, reason: banReason || null });
    await adminLog({
      action: 'ban_user', entity: 'profiles', entity_id: banDialog.userId,
      reason: banReason || (banDialog.permanent ? 'Banimento permanente' : `Banimento por ${days} dias`),
      payload: { usuario: banDialog.userName, permanente: banDialog.permanent, dias: days, depois: { banned_until: until } },
    });
    toast({ title: banDialog.permanent ? 'Usuário banido permanentemente' : `Usuário banido por ${days} dias` });
    setBanDialog({ open: false, userId: null, userName: '', permanent: false }); setBanReason('');
    setDetail(null); fetchAll(true);
  };

  const handleUnban = async (userId: string) => {
    const { error } = await supabase.from('profiles').update({ banned_until: null }).eq('id', userId);
    if (error) { toast({ title: 'Erro ao desbanir', description: error.message, variant: 'destructive' }); return; }
    await logModeration(userId, 'unban', {});
    await adminLog({
      action: 'unban_user', entity: 'profiles', entity_id: userId,
      reason: 'Banimento removido', payload: { depois: { banned_until: null } },
    });
    toast({ title: 'Usuário desbanido' });
    loadBannedAndHistory();
  };

  const openDetail = async (d: Denuncia) => {
    setDetail(d); setDetailContent(''); setLoadingDetail(true);
    try {
      const cfg = TARGET_CONFIG[d.target_type];
      if (!cfg) { setDetailContent(`Tipo desconhecido: ${d.target_type}`); return; }
      const { data } = await (supabase as any).from(cfg.table).select(cfg.select).eq('id', d.target_id).maybeSingle();
      if (!data) { setDetailContent('Conteúdo removido ou não encontrado.'); return; }
      const title = (data as any)[cfg.titleField];
      const rest = Object.entries(data as any)
        .filter(([k]) => k !== cfg.titleField && k !== cfg.authorField && k !== 'id')
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join('\n');
      setDetailContent(`${title || '(sem título)'}\n\n${rest}`);
    } finally { setLoadingDetail(false); }
  };

  // GAP-D179: Exportar CSV
  const exportCSV = () => {
    const data = denuncias.map(d => ({
      ID: d.id.slice(0, 8),
      Tipo: targetTypeLabel(d.target_type),
      Conteúdo: d.target_label,
      Reporter: d.reporter_name,
      Motivo: d.reason,
      Status: statusLabel(d.status),
      Data: formatDateTime(d.created_at),
    }));

    const headers = Object.keys(data[0] || {});
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = (row as any)[h] || '';
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(','))
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `denuncias-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado com sucesso' });
  };

  const pendentes = denuncias.filter(d => d.status === 'pending');
  const resolvidas = denuncias.filter(d => d.status === 'resolved');
  const improcedentes = denuncias.filter(d => d.status === 'dismissed');
  const permanentBans = banned.filter(b => new Date(b.banned_until) > new Date('2900-01-01'));

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Moderação
          </h1>
          <p className="text-muted-foreground text-sm">
            Denúncias, banimentos e histórico de ações · {pendentes.length} pendentes
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Pendentes', value: pendentes.length, icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Resolvidas', value: resolvidas.length, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Improcedentes', value: improcedentes.length, icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted/30' },
          { label: 'Banidos', value: banned.length, icon: UserX, color: 'text-destructive', bg: 'bg-destructive/10' },
          { label: 'Permanentes', value: permanentBans.length, icon: InfinityIcon, color: 'text-accent', bg: 'bg-accent/10' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="py-3 px-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GAP-D187: Tipos mais denunciados */}
      {typeStats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground font-medium mr-1">Tipos mais denunciados:</span>
          {typeStats.map(([type, count]) => (
            <Badge key={type} variant="outline" className="text-xs">
              {targetTypeLabel(type)}: {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário ou conteúdo..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.keys(TARGET_CONFIG).map(k => (
                    <SelectItem key={k} value={k}>{TARGET_CONFIG[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="resolved">Resolvidas</SelectItem>
                  <SelectItem value="dismissed">Improcedentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos os períodos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="denuncias">
        <TabsList>
          <TabsTrigger value="denuncias">
            <Flag className="h-4 w-4 mr-1" />Denúncias ({denuncias.length})
          </TabsTrigger>
          <TabsTrigger value="banidos">
            <UserX className="h-4 w-4 mr-1" />Banidos ({banned.length})
          </TabsTrigger>
          <TabsTrigger value="explorar">
            <Search className="h-4 w-4 mr-1" />Explorar conteúdo
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="h-4 w-4 mr-1" />Histórico ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="denuncias" className="mt-4">
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {denuncias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EstadoVazio titulo="Nenhuma denúncia" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    denuncias.map(d => (
                      <TableRow key={d.id} className="border-border hover:bg-muted/30">
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{targetTypeLabel(d.target_type)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[240px] truncate font-medium">
                          {d.target_label}
                        </TableCell>
                        <TableCell className="text-sm">{d.reporter_name}</TableCell>
                        <TableCell className="text-sm max-w-[160px] truncate">{d.reason}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={statusBadgeClass(d.status)}>
                            {statusLabel(d.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(d.created_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openDetail(d)}>
                            <Eye className="h-3 w-3 mr-1" />Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Paginação */}
          {hasMore && denuncias.length >= ITEMS_PER_PAGE && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => fetchAll(false)}
                disabled={loadingMore}
                className="text-sm"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                Carregar mais
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="banidos" className="mt-4">
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Usuário</TableHead>
                    <TableHead>Banido até</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banned.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="p-0">
                        <EstadoVazio titulo="Nenhum usuário banido" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    banned.map(b => {
                      const isPerm = new Date(b.banned_until) > new Date('2900-01-01');
                      return (
                        <TableRow key={b.id} className="border-border hover:bg-muted/30">
                          <TableCell className="text-sm font-medium">
                            {b.display_name || 'Sem nome'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {isPerm ? '∞ Permanente' : formatDateTime(b.banned_until)}
                          </TableCell>
                          <TableCell>
                            <Badge className={isPerm ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'}>
                              {isPerm ? 'Permanente' : 'Temporário'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleUnban(b.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" />Desbanir
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="explorar" className="mt-4">
          <ContentExplorer
            onLogRemoval={(authorId, refType, refId, reason) =>
              logModeration(authorId, 'delete_content', { reason, reference_type: refType, reference_id: refId })
            }
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Usuário alvo</TableHead>
                    <TableHead>Moderador</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EstadoVazio titulo="Nenhuma ação registrada" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map(h => (
                      <TableRow key={h.id} className="border-border hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(h.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge className={actionColor(h.action)}>
                            {actionLabel(h.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{h.target_name}</TableCell>
                        <TableCell className="text-sm">{h.moderator_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {h.duration_days ? `${h.duration_days} dias` : (h.action === 'ban_permanent' ? '∞' : '—')}
                        </TableCell>
                        <TableCell className="text-sm max-w-[260px] truncate text-muted-foreground">
                          {h.reason || '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-primary" /> Detalhes da denúncia
            </DialogTitle>
            <DialogDescription>
              Reportada por <span className="font-medium text-foreground">{detail?.reporter_name}</span> em {detail && formatDateTime(detail.created_at)}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo do alvo</Label>
                  <p className="font-medium">{targetTypeLabel(detail.target_type)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p><Badge className={statusBadgeClass(detail.status)}>{statusLabel(detail.status)}</Badge></p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Motivo</Label>
                <p className="text-sm">{detail.reason}</p>
              </div>
              {detail.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Descrição da denúncia</Label>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 border border-border">
                    {detail.description}
                  </p>
                </div>
              )}
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  Conteúdo reportado {loadingDetail && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 border border-border max-h-48 overflow-y-auto">
                  {loadingDetail ? 'Carregando...' : (detailContent || '(vazio)')}
                </p>
              </div>
              {detail.status === 'pending' && (
                <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => handleDismiss(detail)}>
                    <XCircle className="h-4 w-4 mr-1" />Improcedente
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleResolve(detail)}>
                    <CheckCircle className="h-4 w-4 mr-1" />Resolver
                  </Button>
                  {TARGET_CONFIG[detail.target_type]?.canDelete && (
                    <Button variant="outline" size="sm" className="text-accent hover:text-accent" onClick={() => handleDeleteContent(detail)}>
                      <Trash2 className="h-4 w-4 mr-1" />Remover conteúdo
                    </Button>
                  )}
                  {detail.target_author_id && (
                    <>
                      <Button size="sm" className="bg-warning hover:bg-warning/90 text-warning-foreground" onClick={() => openBanDialog(detail.target_author_id, detail.target_label, false)}>
                        <Ban className="h-4 w-4 mr-1" />Banir temp.
                      </Button>
                      <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => openBanDialog(detail.target_author_id, detail.target_label, true)}>
                        <InfinityIcon className="h-4 w-4 mr-1" />Banir permanente
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ban dialog */}
      <Dialog open={banDialog.open} onOpenChange={o => !o && setBanDialog({ open: false, userId: null, userName: '', permanent: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{banDialog.permanent ? 'Banir permanentemente' : 'Banir temporariamente'}</DialogTitle>
            <DialogDescription>
              {banDialog.userName && <>Alvo: <span className="font-medium text-foreground">{banDialog.userName}</span></>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!banDialog.permanent && (
              <div className="space-y-2">
                <Label>Duração (dias)</Label>
                <Input type="number" min="1" value={banDays} onChange={e => setBanDays(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Motivo (visível ao usuário)</Label>
              <Textarea value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Ex: Conteúdo ofensivo recorrente..." rows={3} />
            </div>
            <p className="text-xs text-muted-foreground">
              {banDialog.permanent
                ? 'O usuário será impedido de interagir indefinidamente. Esta ação pode ser revertida em "Banidos → Desbanir".'
                : 'O usuário não poderá publicar anúncios, comentar ou interagir até a data definida.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBanDialog({ open: false, userId: null, userName: '', permanent: false })}>
                Cancelar
              </Button>
              <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmBan}>
                <Ban className="h-4 w-4 mr-2" />
                {banDialog.permanent ? 'Banir permanente' : 'Confirmar banimento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}