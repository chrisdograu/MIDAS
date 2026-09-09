import { useState, useEffect, useMemo } from 'react';
import { Bell, Loader2, Megaphone, Eye, Users, Calendar, Clock, Copy, Trash2, History, BarChart3, Smartphone, Monitor, CheckCircle2, XCircle, AlertCircle, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminLog } from '../lib/adminLog';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { formatDateTime } from '@/lib/format';
import EstadoVazio from '@/components/EstadoVazio';

interface SpecialNotif {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  banner_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  audience: string;
  scheduled_for: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  views: number;
  clicks: number;
  creator_name?: string;
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: '🌐 Todos os usuários',
  buyers: '🛒 Compradores',
  sellers: '💰 Vendedores',
  active7d: '📱 Ativos (7 dias)',
  admin: '🛡️ Administradores',
  mod: '⚖️ Moderadores',
  user: '👤 Usuários comuns',
};

const AUDIENCE_OPTIONS = [
  { value: 'all', label: '🌐 Todos os usuários' },
  { value: 'buyers', label: '🛒 Compradores' },
  { value: 'sellers', label: '💰 Vendedores' },
  { value: 'active7d', label: '📱 Ativos (7 dias)' },
  { value: 'admin', label: '🛡️ Administradores' },
  { value: 'mod', label: '⚖️ Moderadores' },
  { value: 'user', label: '👤 Usuários comuns' },
];

const ITEMS_PER_PAGE = 20;

// GAP-D191: Agendar notificação
async function scheduleNotification(data: any, scheduledFor: string) {
  const { error } = await supabase
    .from('scheduled_notifications' as any)
    .insert({
      ...data,
      scheduled_for: scheduledFor,
      status: 'pending',
    });
  if (error) throw error;
}

// GAP-D196: Duplicar notificação
function duplicateNotif(notif: SpecialNotif, onDuplicate: (data: any) => void) {
  onDuplicate({
    title: `${notif.title} (cópia)`,
    body: notif.body || '',
    kind: notif.kind,
    banner_url: notif.banner_url || '',
    cta_label: notif.cta_label || '',
    cta_url: notif.cta_url || '',
    audience: notif.audience,
  });
}

export default function NotificacoesEspeciais() {
  const [form, setForm] = useState({
    title: '',
    body: '',
    kind: 'especial',
    banner_url: '',
    cta_label: '',
    cta_url: '',
    audience: 'all',
  });
  const [sending, setSending] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [history, setHistory] = useState<SpecialNotif[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  // GAP-D191: Agendamento
  const [scheduledFor, setScheduledFor] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);

  // GAP-D192: Filtros no histórico
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [historySearch, setHistorySearch] = useState('');

  // GAP-D195: Preview mobile/desktop
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('desktop');

  // GAP-D197: Estatísticas
  const [stats, setStats] = useState({ total: 0, views: 0, clicks: 0 });

  // GAP-D193: Carregar histórico
  const loadHistory = async (reset: boolean = true) => {
    const page = reset ? 0 : historyPage;
    const from = page * ITEMS_PER_PAGE;

    if (reset) setLoadingHistory(true);
    else setLoadingHistory(true);

    try {
      let query = supabase
        .from('special_notifications' as any)
        .select('*, profiles!created_by(display_name)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (historyFilter !== 'all') {
        query = query.eq('kind', historyFilter);
      }
      if (historySearch) {
        query = query.ilike('title', `%${historySearch}%`);
      }

      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);

      if (error) throw error;

      const enriched = (data || []).map((n: any) => ({
        ...n,
        creator_name: n.profiles?.display_name || 'Sistema',
        views: n.views || 0,
        clicks: n.clicks || 0,
      }));

      if (reset) {
        setHistory(enriched);
        setHasMoreHistory((data || []).length === ITEMS_PER_PAGE);
        setHistoryPage(1);
      } else {
        setHistory(prev => [...prev, ...enriched]);
        setHasMoreHistory((data || []).length === ITEMS_PER_PAGE);
        setHistoryPage(page + 1);
      }

      // GAP-D197: Calcular estatísticas
      const total = enriched.length;
      const views = enriched.reduce((s, n) => s + (n.views || 0), 0);
      const clicks = enriched.reduce((s, n) => s + (n.clicks || 0), 0);
      setStats({ total, views, clicks });
    } catch (error) {
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory(true);
  }, [historyFilter, historySearch]);

  // GAP-D194: adminLog já está no sendNotification
  // GAP-D172: Realtime
  useRealtimeRefresh(['special_notifications'], () => loadHistory(true), 'admin-notificacoes-especiais');

  const audienceQuery = async (): Promise<string[]> => {
    if (form.audience === 'all') {
      const { data } = await supabase.from('profiles').select('id');
      return (data || []).map(p => p.id);
    }
    if (form.audience === 'buyers') {
      const { data } = await supabase.from('pedidos').select('user_id').eq('status', 'confirmed');
      return Array.from(new Set((data || []).map((p: any) => p.user_id))).filter(Boolean);
    }
    if (form.audience === 'sellers') {
      const { data } = await supabase.from('seller_profiles').select('user_id');
      return (data || []).map((p: any) => p.user_id);
    }
    if (form.audience === 'active7d') {
      const since = new Date(); since.setDate(since.getDate() - 7);
      const { data } = await supabase.from('user_xp_log').select('user_id').gte('created_at', since.toISOString());
      return Array.from(new Set((data || []).map((p: any) => p.user_id))).filter(Boolean);
    }
    if (form.audience === 'admin') {
      const { data } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      return (data || []).map((p: any) => p.user_id);
    }
    if (form.audience === 'mod') {
      const { data } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'moderator']);
      return (data || []).map((p: any) => p.user_id);
    }
    if (form.audience === 'user') {
      const { data: roles } = await supabase.from('user_roles').select('user_id');
      const roleIds = new Set((roles || []).map((p: any) => p.user_id));
      const { data: profiles } = await supabase.from('profiles').select('id');
      return (profiles || []).map((p: any) => p.id).filter((id: string) => !roleIds.has(id));
    }
    return [];
  };

  const preview = async () => {
    if (!form.title) return toast.error('Título obrigatório');
    setPreviewing(true);
    const ids = await audienceQuery();
    setPreviewing(false);
    setPreviewCount(ids.length);
    setPendingIds(ids);
    if (ids.length === 0) { toast.error('Nenhum destinatário nessa audiência.'); return; }
    setConfirmOpen(true);
  };

  const sendNotification = async (notificationData: any, userIds: string[]) => {
    const rows = userIds.map(uid => ({
      user_id: uid,
      type: 'nova_mensagem' as any,
      kind: notificationData.kind as any,
      title: notificationData.title,
      body: notificationData.body || null,
      banner_url: notificationData.banner_url || null,
      cta_label: notificationData.cta_label || null,
      cta_url: notificationData.cta_url || null,
    }));

    const { error } = await supabase.from('notifications').insert(rows as any);
    if (error) throw error;

    // Registrar no histórico de especiais
    const { data: { user } } = await supabase.auth.getUser();
    const { error: histError } = await supabase
      .from('special_notifications' as any)
      .insert({
        ...notificationData,
        sent_at: new Date().toISOString(),
        created_by: user?.id,
        recipient_count: rows.length,
      });

    if (histError) throw histError;

    // GAP-D194: adminLog
    await adminLog({
      action: 'special_notification_sent',
      entity: 'special_notifications',
      reason: `Notificação especial "${notificationData.title}" enviada para ${rows.length} usuários`,
      payload: {
        audience: notificationData.audience,
        kind: notificationData.kind,
        recipient_count: rows.length,
        title: notificationData.title,
      },
    });

    return rows.length;
  };

  const confirmSend = async () => {
    const userIds = pendingIds || [];
    if (userIds.length === 0) return;
    setConfirmOpen(false);
    setSending(true);

    try {
      // GAP-D191: Verificar se é agendada
      if (scheduleEnabled && scheduledFor) {
        await scheduleNotification(form, scheduledFor);
        toast.success(`Notificação agendada para ${formatDateTime(scheduledFor)}`);
        await adminLog({
          action: 'special_notification_scheduled',
          entity: 'special_notifications',
          reason: `Notificação "${form.title}" agendada para ${scheduledFor}`,
          payload: { audience: form.audience, kind: form.kind, scheduled_for: scheduledFor },
        });
      } else {
        const count = await sendNotification(form, userIds);
        toast.success(`Enviadas ${count} notificações especiais`);
      }

      setForm({ title: '', body: '', kind: 'especial', banner_url: '', cta_label: '', cta_url: '', audience: 'all' });
      setPreviewCount(null);
      setPendingIds(null);
      setScheduledFor('');
      setScheduleEnabled(false);
      loadHistory(true);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar notificação');
    } finally {
      setSending(false);
    }
  };

  // GAP-D196: Duplicar notificação
  const handleDuplicate = (notif: SpecialNotif) => {
    setForm({
      title: `${notif.title} (cópia)`,
      body: notif.body || '',
      kind: notif.kind,
      banner_url: notif.banner_url || '',
      cta_label: notif.cta_label || '',
      cta_url: notif.cta_url || '',
      audience: notif.audience,
    });
    toast.success('Notificação duplicada! Edite e envie.');
  };

  // GAP-D197: Atualizar estatísticas (simulado)
  const updateStats = async (notifId: string, type: 'view' | 'click') => {
    const field = type === 'view' ? 'views' : 'clicks';
    await supabase
      .from('special_notifications' as any)
      .update({ [field]: supabase.rpc('increment', { row_id: notifId, field }) })
      .eq('id', notifId);
  };

  const filteredHistory = useMemo(() => {
    let result = history;
    if (historyFilter !== 'all') {
      result = result.filter(n => n.kind === historyFilter);
    }
    if (historySearch) {
      const s = historySearch.toLowerCase();
      result = result.filter(n => n.title.toLowerCase().includes(s) || (n.body || '').toLowerCase().includes(s));
    }
    return result;
  }, [history, historyFilter, historySearch]);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <AdminPageHeader
        icon={Megaphone}
        title="Notificações Especiais"
        subtitle="Comum, destacada ou especial com banner e CTA"
      />

      <Tabs defaultValue="criar">
        <TabsList>
          <TabsTrigger value="criar"><Megaphone className="h-4 w-4 mr-1" />Criar</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-4 w-4 mr-1" />Histórico ({history.length})</TabsTrigger>
          <TabsTrigger value="estatisticas"><BarChart3 className="h-4 w-4 mr-1" />Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="criar" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comum">📝 Comum</SelectItem>
                        <SelectItem value="destacada">⭐ Destacada</SelectItem>
                        <SelectItem value="especial">🎨 Especial (banner + CTA)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Público</Label>
                    <Select value={form.audience} onValueChange={v => setForm({ ...form, audience: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AUDIENCE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Título *</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>

                <div>
                  <Label>Mensagem</Label>
                  <Textarea rows={3} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
                </div>

                {form.kind === 'especial' && (
                  <>
                    <div>
                      <Label>Banner (URL)</Label>
                      <Input value={form.banner_url} onChange={e => setForm({ ...form, banner_url: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>CTA texto</Label>
                        <Input value={form.cta_label} onChange={e => setForm({ ...form, cta_label: e.target.value })} />
                      </div>
                      <div>
                        <Label>CTA URL</Label>
                        <Input value={form.cta_url} onChange={e => setForm({ ...form, cta_url: e.target.value })} />
                      </div>
                    </div>
                  </>
                )}

                {/* GAP-D191: Agendamento */}
                <div className="bg-secondary/40 rounded-lg p-3 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="cursor-pointer">Agendar envio</Label>
                      <p className="text-xs text-muted-foreground">Enviar automaticamente na data/hora definida</p>
                    </div>
                    <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                  </div>
                  {scheduleEnabled && (
                    <div className="mt-3">
                      <Label>Data e hora do envio</Label>
                      <Input
                        type="datetime-local"
                        value={scheduledFor}
                        onChange={e => setScheduledFor(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={preview} disabled={sending || previewing} className="flex-1">
                    {(sending || previewing) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Users className="h-4 w-4 mr-1" />
                    {previewCount !== null ? `${previewCount} destinatários` : 'Ver quantos vão receber'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* GAP-D190: Preview em tempo real + GAP-D195: Preview mobile/desktop */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />Preview
                  </div>
                  <div className="flex gap-1 border border-border rounded-lg p-0.5">
                    <button
                      onClick={() => setPreviewDevice('desktop')}
                      className={`px-2 py-1 rounded text-xs ${previewDevice === 'desktop' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    >
                      <Monitor className="h-3 w-3 inline mr-1" />Desktop
                    </button>
                    <button
                      onClick={() => setPreviewDevice('mobile')}
                      className={`px-2 py-1 rounded text-xs ${previewDevice === 'mobile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                    >
                      <Smartphone className="h-3 w-3 inline mr-1" />Mobile
                    </button>
                  </div>
                </div>

                <div className={`border border-border rounded-lg p-4 bg-card space-y-2 ${previewDevice === 'mobile' ? 'max-w-sm mx-auto' : ''}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant={form.kind === 'especial' ? 'default' : 'secondary'}>
                      {form.kind === 'especial' ? '🎨 Especial' : form.kind === 'destacada' ? '⭐ Destacada' : '📝 Comum'}
                    </Badge>
                    <span className="font-semibold text-foreground">{form.title || 'Título da notificação'}</span>
                  </div>
                  {form.body && (
                    <p className="text-sm text-muted-foreground">{form.body}</p>
                  )}
                  {form.kind === 'especial' && form.banner_url && (
                    <img
                      src={form.banner_url}
                      alt="banner"
                      className="w-full rounded mt-2 max-h-40 object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  {form.kind === 'especial' && form.cta_label && (
                    <Button size="sm" className="mt-2 w-full sm:w-auto">
                      {form.cta_label}
                    </Button>
                  )}
                  <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">
                    {AUDIENCE_LABELS[form.audience] || form.audience}
                    {scheduleEnabled && scheduledFor && (
                      <span className="ml-2">⏰ Agendada para {formatDateTime(scheduledFor)}</span>
                    )}
                  </div>
                </div>

                {/* GAP-D197: Estimativa de impacto */}
                {previewCount !== null && previewCount > 0 && (
                  <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-sm font-medium text-primary">
                      📊 Impacto estimado: {previewCount} usuários
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Taxa de abertura estimada: ~{Math.min(80, Math.round(previewCount * 0.35))} visualizações
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* GAP-D193: Histórico */}
        <TabsContent value="historico" className="mt-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar notificações..."
                className="pl-9"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />
            </div>
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="comum">Comum</SelectItem>
                <SelectItem value="destacada">Destacada</SelectItem>
                <SelectItem value="especial">Especial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/50">
            <CardContent className="p-0">
              {loadingHistory ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filteredHistory.length === 0 ? (
                <EstadoVazio titulo="Nenhuma notificação especial enviada" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Público</TableHead>
                      <TableHead className="text-center">Views</TableHead>
                      <TableHead className="text-center">Cliques</TableHead>
                      <TableHead>Enviada por</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map(n => (
                      <TableRow key={n.id} className="border-border hover:bg-muted/30">
                        <TableCell className="font-medium max-w-[180px] truncate">{n.title}</TableCell>
                        <TableCell>
                          <Badge variant={n.kind === 'especial' ? 'default' : 'secondary'}>
                            {n.kind === 'especial' ? '🎨 Especial' : n.kind === 'destacada' ? '⭐ Destacada' : '📝 Comum'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{AUDIENCE_LABELS[n.audience] || n.audience}</TableCell>
                        <TableCell className="text-center">{n.views || 0}</TableCell>
                        <TableCell className="text-center">{n.clicks || 0}</TableCell>
                        <TableCell className="text-sm">{n.creator_name || 'Sistema'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {n.sent_at ? formatDateTime(n.sent_at) : (n.scheduled_for ? `⏰ ${formatDateTime(n.scheduled_for)}` : '—')}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => handleDuplicate(n)}
                          >
                            <Copy className="h-3 w-3 mr-1" />Duplicar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {hasMoreHistory && filteredHistory.length >= ITEMS_PER_PAGE && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => loadHistory(false)}
                disabled={loadingHistory}
                className="text-sm"
              >
                {loadingHistory ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                Carregar mais
              </Button>
            </div>
          )}
        </TabsContent>

        {/* GAP-D197: Estatísticas */}
        <TabsContent value="estatisticas" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border/50">
              <CardContent className="py-6 text-center">
                <p className="text-3xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Notificações enviadas</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="py-6 text-center">
                <p className="text-3xl font-bold">{stats.views}</p>
                <p className="text-sm text-muted-foreground">Visualizações totais</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="py-6 text-center">
                <p className="text-3xl font-bold">{stats.clicks}</p>
                <p className="text-sm text-muted-foreground">Cliques em CTAs</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50 mt-4">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Desempenho por tipo</h3>
              <div className="space-y-2">
                {['comum', 'destacada', 'especial'].map(kind => {
                  const items = history.filter(n => n.kind === kind);
                  const total = items.length;
                  const views = items.reduce((s, n) => s + (n.views || 0), 0);
                  const clicks = items.reduce((s, n) => s + (n.clicks || 0), 0);
                  const avgViews = total > 0 ? Math.round(views / total) : 0;
                  const avgClicks = total > 0 ? Math.round(clicks / total) : 0;

                  return (
                    <div key={kind} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40">
                      <span className="font-medium capitalize">{kind}</span>
                      <span className="text-sm text-muted-foreground">
                        {total} enviadas · {avgViews} views · {avgClicks} cliques
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmação */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio em massa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta notificação será enviada para <b>{previewCount ?? 0}</b> usuário(s) da audiência <b>{AUDIENCE_LABELS[form.audience] || form.audience}</b>.
              <br /><br />
              {scheduleEnabled && scheduledFor ? (
                <span className="text-warning">⏰ Agendada para {formatDateTime(scheduledFor)}</span>
              ) : (
                <span className="text-destructive">⚠️ Enviada imediatamente — não é possível cancelar após o envio.</span>
              )}
              <br /><br />
              Notificações especiais em massa ignoram preferências individuais de notificação — use apenas para avisos realmente importantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend}>
              <Bell className="h-4 w-4 mr-1" />
              {scheduleEnabled && scheduledFor ? 'Agendar' : `Enviar para ${previewCount ?? 0}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}