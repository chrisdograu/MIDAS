import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameProductSelect } from '../components/GameProductSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Plus, Loader2, Users, Shuffle, Trash2, Edit, Gift, AlertTriangle, MessageCircle, Ban, Search, Download, ChevronLeft, ChevronRight, Filter, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { adminLog } from '../lib/adminLog';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate, formatDateTime } from '@/lib/format';

interface T {
  id: string; title: string; description: string | null; type: string; status: string;
  prize: string | null; max_participants: number; starts_at: string | null; ends_at: string | null;
  xp_signup?: number | null; xp_match_win?: number | null; xp_champion?: number | null;
  verified?: boolean | null; prize_types?: string[] | null; prize_xp_bonus?: number | null;
  rewards_distributed?: boolean | null;
  stream_url?: string | null; default_format?: string | null; default_bo?: number | null; walkover_minutes?: number | null;
}

const PRIZE_OPTIONS = [
  { id: 'game', label: '🎮 Jogo grátis' },
  { id: 'coupon', label: '🎟️ Cupom de desconto' },
  { id: 'badge', label: '🏅 Badge exclusivo' },
  { id: 'title', label: '👑 Título de conquista' },
  { id: 'xp_bonus', label: '⚡ XP bônus' },
];

const ITEMS_PER_PAGE = 12;

const empty = {
  id: '', title: '', description: '', type: 'semanal', status: 'open',
  max_participants: 16, starts_at: '', ends_at: '',
  verified: false, prize_types: [] as string[], prize_xp_bonus: 0, prize_title: '',
  stream_url: '', default_format: 'single_elimination', default_bo: 1, walkover_minutes: 15,
  product_id: null as string | null,
};

function calcXp(n: number) {
  if (n <= 8) return { s: 30, w: 100, c: 500 };
  if (n <= 16) return { s: 40, w: 130, c: 650 };
  if (n <= 32) return { s: 55, w: 170, c: 850 };
  if (n <= 64) return { s: 70, w: 220, c: 1100 };
  return { s: 90, w: 280, c: 1400 };
}

export default function TorneiosAdmin() {
  const [list, setList] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [bracketFor, setBracketFor] = useState<T | null>(null);
  const [participants, setParticipants] = useState<{ user_id: string; display_name: string | null; final_rank: number | null }[]>([]);
  const [bans, setBans] = useState<{ id: string; user_id: string; display_name: string | null; reason: string | null; created_at: string }[]>([]);
  const [banReason, setBanReason] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<T | null>(null);
  const [confirmDistribute, setConfirmDistribute] = useState<T | null>(null);
  const [confirmRegen, setConfirmRegen] = useState<(() => void) | null>(null);

  // GAP-D291: Filtros
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async (reset: boolean = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const currentPage = reset ? 0 : page;
    const from = currentPage * ITEMS_PER_PAGE;

    try {
      let query = supabase.from('tournaments' as any).select('*', { count: 'exact' }).order('created_at', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      const { data, error, count } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      if (error) throw error;

      if (reset) {
        setList((data as any) || []);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(1);
      } else {
        setList(prev => [...prev, ...((data as any) || [])]);
        setHasMore((data || []).length === ITEMS_PER_PAGE);
        setPage(currentPage + 1);
      }

      // Carregar alertas
      const { data: dups } = await supabase.from('tournament_duplicate_alerts' as any).select('*').eq('resolved', false).order('created_at', { ascending: false });
      setAlerts((dups as any) || []);
    } catch (error) {
      toast.error('Erro ao carregar torneios');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => { load(true); }, [typeFilter, statusFilter, search]);

  // GAP-D299: Realtime
  useRealtimeRefresh(['tournaments', 'tournament_participants', 'tournament_matches'], () => load(true), 'admin-torneios');

  // GAP-D293: Estatísticas
  const stats = useMemo(() => {
    const total = list.length;
    const abertos = list.filter(t => t.status === 'open').length;
    const emAndamento = list.filter(t => t.status === 'running').length;
    const encerrados = list.filter(t => t.status === 'closed').length;
    const participantes = list.reduce((acc, t) => acc + (t.max_participants || 0), 0);
    return { total, abertos, emAndamento, encerrados, participantes };
  }, [list]);

  const xpPreview = useMemo(() => calcXp(Number(form.max_participants) || 16), [form.max_participants]);

  // GAP-D297: Notificar usuários
  const notifyParticipants = async (tournamentId: string, title: string, body: string) => {
    const { data: participants } = await supabase
      .from('tournament_participants' as any)
      .select('user_id')
      .eq('tournament_id', tournamentId);

    if (!participants || participants.length === 0) return;

    const notifications = participants.map(p => ({
      user_id: p.user_id,
      type: 'tournament',
      title,
      body,
      reference_type: 'tournament',
      reference_id: tournamentId,
    }));

    await supabase.from('notifications').insert(notifications);
  };

  const save = async () => {
    if (!form.title) return toast.error('Título obrigatório');

    // GAP-D296: Validar datas
    if (form.starts_at && form.ends_at && form.starts_at > form.ends_at) {
      return toast.error('Data de início não pode ser após a data de fim');
    }

    const payload = {
      title: form.title, description: form.description || null, type: form.type, status: form.status,
      max_participants: Number(form.max_participants) || 16,
      starts_at: form.starts_at || null, ends_at: form.ends_at || null,
      verified: !!form.verified,
      prize_types: form.prize_types?.length ? form.prize_types : null,
      prize_xp_bonus: Number(form.prize_xp_bonus) || 0,
      prize_title: form.prize_title || null,
      stream_url: form.stream_url?.trim() || null,
      default_format: form.default_format || 'single_elimination',
      default_bo: Number(form.default_bo) || 1,
      walkover_minutes: Number(form.walkover_minutes) || 15,
      product_id: form.product_id || null,
    };
    const anterior = editing ? list.find((t: any) => t.id === editing) : null;
    const op = editing
      ? supabase.from('tournaments' as any).update(payload).eq('id', editing).select('id').single()
      : supabase.from('tournaments' as any).insert(payload).select('id').single();
    const { data: saved, error } = await op as any;
    if (error) return toast.error(error.message);

    // GAP-D295: adminLog melhorado
    await adminLog({
      action: editing ? 'update_tournament' : 'create_tournament',
      entity: 'tournaments',
      entity_id: (saved as any)?.id ?? editing ?? null,
      reason: `Torneio "${payload.title}" ${editing ? 'atualizado' : 'criado'}`,
      payload: editing ? { antes: anterior ? { title: (anterior as any).title, status: (anterior as any).status, max_participants: (anterior as any).max_participants, starts_at: (anterior as any).starts_at } : null, depois: payload } : payload,
    });

    // GAP-D297: Notificar participantes se for criação
    if (!editing && (saved as any)?.id) {
      await notifyParticipants(
        (saved as any).id,
        `🏆 Novo torneio: ${payload.title}`,
        `O torneio "${payload.title}" está com inscrições abertas! Participe agora.`
      );
    }

    toast.success('Salvo!');
    setDialog(false); setForm(empty); setEditing(null); load(true);
  };

  const remove = async (t: T) => {
    const { error } = await supabase.from('tournaments' as any).delete().eq('id', t.id);
    if (error) return toast.error(error.message);
    await adminLog({
      action: 'delete_tournament',
      entity: 'tournaments',
      entity_id: (t as any).id,
      reason: `Torneio "${(t as any).title}" removido`,
      payload: { title: (t as any).title, status: (t as any).status }
    });
    toast.success('Removido');
    load(true);
  };

  // GAP-D292: Exportar CSV
  const exportCSV = () => {
    setExporting(true);
    const data = list.map(t => ({
      Título: t.title,
      Tipo: t.type,
      Status: t.status,
      'Max Participantes': t.max_participants,
      'XP Inscrição': t.xp_signup || 0,
      'XP Vitória': t.xp_match_win || 0,
      'XP Campeão': t.xp_champion || 0,
      Início: t.starts_at ? formatDateTime(t.starts_at) : '',
      Fim: t.ends_at ? formatDateTime(t.ends_at) : '',
      Verificado: t.verified ? 'Sim' : 'Não',
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
    a.download = `torneios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success('CSV exportado com sucesso');
  };

  const openBracket = async (t: T) => {
    setBracketFor(t);
    const { data } = await supabase.from('tournament_participants' as any).select('user_id, final_rank').eq('tournament_id', t.id);
    const list = ((data as any) || []) as any[];
    const ids = [...new Set(list.map(p => p.user_id).filter(Boolean))];
    let nameMap = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids);
      nameMap = new Map((profs || []).map((p: any) => [p.id, p.display_name || 'Jogador']));
    }
    setParticipants(list.map(p => ({ user_id: p.user_id, display_name: nameMap.get(p.user_id), final_rank: p.final_rank })));
    await loadBans(t.id);
  };

  const loadBans = async (tournamentId: string) => {
    const { data } = await supabase.from('tournament_bans' as any).select('id, user_id, reason, created_at').eq('tournament_id', tournamentId);
    const list = (data as any) || [];
    const userIds = list.map((b: any) => b.user_id);
    let nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', userIds);
      nameMap = new Map((profs || []).map(p => [p.id, p.display_name || '']));
    }
    setBans(list.map((b: any) => ({ ...b, display_name: nameMap.get(b.user_id) || null })));
  };

  const banUser = async (userId: string) => {
    if (!bracketFor) return;
    const { error } = await supabase.from('tournament_bans' as any).insert({
      tournament_id: bracketFor.id, user_id: userId, reason: banReason || null,
    });
    if (error) return toast.error(error.message);
    await adminLog({
      action: 'ban_tournament_user',
      entity: 'tournaments',
      entity_id: bracketFor.id,
      reason: banReason || 'Banimento em torneio',
      payload: { user_id: userId, torneio: (bracketFor as any).title }
    });
    toast.success('Usuário banido do torneio');
    setBanReason('');
    await loadBans(bracketFor.id);
    openBracket(bracketFor);
  };

  const unbanUser = async (banId: string) => {
    if (!bracketFor) return;
    const { error: err } = await supabase.from('tournament_bans' as any).delete().eq('id', banId);
    if (err) return toast.error(err.message);
    await adminLog({
      action: 'unban_tournament_user',
      entity: 'tournaments',
      entity_id: bracketFor?.id ?? null,
      reason: 'Banimento de torneio removido',
      payload: { ban_id: banId }
    });
    toast.success('Banimento removido');
    await loadBans(bracketFor.id);
  };

  const doGenerateBracket = async () => {
    if (!bracketFor) return;
    const { error: errClear } = await supabase.from('tournament_matches' as any).delete().eq('tournament_id', bracketFor.id);
    if (errClear) return toast.error(errClear.message);
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const pairs: any[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      pairs.push({
        tournament_id: bracketFor.id, round: 1, position: pairs.length,
        player_a: shuffled[i]?.user_id || null,
        player_b: shuffled[i + 1]?.user_id || null,
        status: 'pending',
      });
    }
    if (pairs.length === 0) return toast.error('Sem participantes');
    const { error } = await supabase.from('tournament_matches' as any).insert(pairs);
    if (error) return toast.error(error.message);
    const { error: errStatus } = await supabase.from('tournaments' as any).update({ status: 'running' }).eq('id', bracketFor.id);
    if (errStatus) return toast.error(errStatus.message);
    await adminLog({
      action: 'generate_bracket',
      entity: 'tournaments',
      entity_id: bracketFor.id,
      reason: `Chaves geradas para "${(bracketFor as any).title}"`,
      payload: { partidas: pairs.length }
    });
    toast.success('Chaves geradas!');
    setBracketFor(null); load(true);
  };

  const generateBracket = async () => {
    if (!bracketFor) return;
    const { data: existing } = await supabase.from('tournament_matches' as any).select('id').eq('tournament_id', bracketFor.id);
    if ((existing as any)?.length) {
      setConfirmRegen(() => doGenerateBracket);
      return;
    }
    doGenerateBracket();
  };

  const setRank = async (userId: string, rank: number | null) => {
    if (!bracketFor) return;
    const before = participants.find(p => p.user_id === userId)?.final_rank ?? null;
    const { error: errRank } = await supabase.from('tournament_participants' as any).update({ final_rank: rank }).eq('tournament_id', bracketFor.id).eq('user_id', userId);
    if (errRank) return toast.error(errRank.message);
    await adminLog({
      action: 'set_tournament_final_rank',
      entity: 'tournaments',
      entity_id: bracketFor.id,
      reason: 'Classificação final alterada pela administração',
      payload: { user_id: userId, antes: before, depois: rank, torneio: (bracketFor as any).title ?? null },
    });
    openBracket(bracketFor);
  };

  const distribute = async (t: T) => {
    const { error } = await supabase.rpc('award_tournament_rewards' as any, { _tournament_id: t.id });
    if (error) return toast.error(error.message);
    await adminLog({
      action: 'award_tournament_rewards',
      entity: 'tournaments',
      entity_id: t.id,
      reason: 'Recompensas distribuídas',
      payload: { torneio: (t as any).title ?? null }
    });

    // Notificar vencedores
    const { data: winners } = await supabase
      .from('tournament_participants' as any)
      .select('user_id, final_rank')
      .eq('tournament_id', t.id)
      .in('final_rank', [1, 2, 3]);

    if (winners && winners.length > 0) {
      const notifications = winners.map(w => ({
        user_id: w.user_id,
        type: 'tournament',
        title: `🏆 Recompensa recebida!`,
        body: `Você recebeu suas recompensas pelo torneio "${t.title}" (${w.final_rank}º lugar)!`,
        reference_type: 'tournament',
        reference_id: t.id,
      }));
      await supabase.from('notifications').insert(notifications);
    }

    toast.success('Recompensas distribuídas!');
    load(true);
  };

  const talkToParticipant = async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing, error: errFind } = await supabase.from('conversas').select('id')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${userId}),and(participant_1.eq.${userId},participant_2.eq.${user.id})`)
      .limit(1).maybeSingle();
    if (errFind) return toast.error(errFind.message);
    let convId = existing?.id;
    if (!convId) {
      const { data: c, error: errConv } = await supabase.from('conversas').insert({
        participant_1: user.id, participant_2: userId, status: 'accepted',
      } as any).select('id').single();
      if (errConv) return toast.error(errConv.message);
      convId = c?.id;
    }
    if (!convId) return toast.error('Não foi possível abrir a conversa');
    if (bracketFor) {
      const { error: errMsg } = await supabase.from('mensagens').insert({
        sender_id: user.id, receiver_id: userId,
        content: `[Admin · Torneio "${bracketFor.title}"]`,
        tournament_id: bracketFor.id, is_admin_chat: true,
      } as any);
      if (errMsg) return toast.error(errMsg.message);
    }
    toast.success('Conversa aberta');
  };

  const renderCard = (t: T) => (
    <div key={t.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-1.5">{t.title}{t.verified && <span title="Verificado" className="text-success text-xs">✓</span>}</h3>
          <p className="text-xs text-muted-foreground uppercase">{t.type} · {t.status}</p>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => { setForm({ ...t, description: t.description || '', starts_at: t.starts_at || '', ends_at: t.ends_at || '', prize_types: t.prize_types || [], prize_xp_bonus: t.prize_xp_bonus || 0, verified: !!t.verified, prize_title: (t as any).prize_title || '' }); setEditing(t.id); setDialog(true); }}><Edit className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => setConfirmDelete(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        XP: <b>{t.xp_signup ?? 0}</b>/<b>{t.xp_match_win ?? 0}</b>/<b>{t.xp_champion ?? 0}</b>
        {t.prize_types?.length ? <span> · 🎁 {t.prize_types.length} tipo(s)</span> : null}
        {t.starts_at && <span className="ml-2"><Calendar className="h-3 w-3 inline mr-1" />{formatDate(t.starts_at)}</span>}
      </div>
      <Button size="sm" variant="outline" className="w-full" onClick={() => openBracket(t)}><Users className="h-3.5 w-3.5 mr-1" /> Participantes & Chaves</Button>
      {t.status === 'closed' && !t.rewards_distributed && (
        <Button size="sm" className="w-full" onClick={() => setConfirmDistribute(t)}><Gift className="h-3.5 w-3.5 mr-1" /> Distribuir recompensas</Button>
      )}
      {t.rewards_distributed && <p className="text-[10px] text-success text-center">✓ Recompensas distribuídas</p>}
    </div>
  );

  const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
  const paginated = list.slice(0, (page + 1) * ITEMS_PER_PAGE);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6 text-primary" /> Torneios</h1>
          <p className="text-sm text-muted-foreground">Gerencie torneios, recompensas e detecção de duplicatas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" />
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar CSV'}
          </Button>
          <Button onClick={() => { setForm(empty); setEditing(null); setDialog(true); }}><Plus className="h-4 w-4 mr-1" /> Novo Torneio</Button>
        </div>
      </div>

      {/* GAP-D293: Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Trophy, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Abertos', value: stats.abertos, icon: Calendar, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Em Andamento', value: stats.emAndamento, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Encerrados', value: stats.encerrados, icon: Trophy, color: 'text-muted-foreground', bg: 'bg-muted/30' },
          { label: 'Participantes', value: stats.participantes, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="py-3 px-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`h-4 w-4 ${s.color}`} /></div>
              <div><p className="text-xl font-bold">{s.value}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="py-3 px-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar torneio..." 
              className="pl-9" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="running">Em andamento</SelectItem>
              <SelectItem value="closed">Encerrados</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTypeFilter('all'); setStatusFilter('all'); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      {alerts.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">{alerts.length} alerta(s) de duplicata</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {alerts.slice(0, 3).map(a => (
                  <Badge key={a.id} variant="outline" className="text-[10px] bg-warning/10 border-warning/30">
                    {a.reason}
                  </Badge>
                ))}
                {alerts.length > 3 && (
                  <Badge variant="outline" className="text-[10px]">+{alerts.length - 3} mais</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos ({list.length})</TabsTrigger>
          <TabsTrigger value="open">Abertos ({list.filter(t => t.status === 'open').length})</TabsTrigger>
          <TabsTrigger value="running">Em andamento ({list.filter(t => t.status === 'running').length})</TabsTrigger>
          <TabsTrigger value="closed">Encerrados ({list.filter(t => t.status === 'closed').length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{paginated.map(renderCard)}</div>
        </TabsContent>
        <TabsContent value="open" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{list.filter(t => t.status === 'open').map(renderCard)}</div>
        </TabsContent>
        <TabsContent value="running" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{list.filter(t => t.status === 'running').map(renderCard)}</div>
        </TabsContent>
        <TabsContent value="closed" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{list.filter(t => t.status === 'closed').map(renderCard)}</div>
        </TabsContent>
      </Tabs>

      {/* GAP-D290: Paginação */}
      {list.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Mostrando {Math.min((page + 1) * ITEMS_PER_PAGE, list.length)} de {list.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs flex items-center px-2">{page + 1} / {totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={!hasMore || (page + 1) * ITEMS_PER_PAGE >= list.length} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Torneio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <GameProductSelect value={form.product_id || null} onChange={v => setForm({ ...form, product_id: v })} />
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="semanal">Semanal</SelectItem><SelectItem value="mensal">Mensal</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="open">Aberto</SelectItem><SelectItem value="running">Em andamento</SelectItem><SelectItem value="closed">Encerrado</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Máx. participantes</Label><Input type="number" value={form.max_participants} onChange={e => setForm({ ...form, max_participants: e.target.value })} /></div>
              <div><Label>Início</Label><Input type="datetime-local" value={form.starts_at?.slice(0, 16) || ''} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="datetime-local" value={form.ends_at?.slice(0, 16) || ''} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></div>
            </div>

            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regras padrão & Transmissão</p>
              <div><Label>URL da transmissão ao vivo (Twitch / YouTube)</Label>
                <Input type="url" placeholder="https://twitch.tv/..." value={form.stream_url || ''} onChange={e => setForm({ ...form, stream_url: e.target.value })} />
                <p className="text-[10px] text-muted-foreground mt-1">Quando preenchido e o torneio estiver "em andamento", aparece o badge 🔴 AO VIVO no card.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Formato padrão</Label>
                  <Select value={form.default_format || 'single_elimination'} onValueChange={v => setForm({ ...form, default_format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_elimination">Eliminação simples</SelectItem>
                      <SelectItem value="double_elimination">Eliminação dupla</SelectItem>
                      <SelectItem value="round_robin">Todos contra todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Best of (BO)</Label>
                  <Input type="number" min={1} max={9} value={form.default_bo || 1} onChange={e => setForm({ ...form, default_bo: e.target.value })} />
                </div>
                <div><Label>Walkover (min)</Label>
                  <Input type="number" min={5} max={60} value={form.walkover_minutes || 15} onChange={e => setForm({ ...form, walkover_minutes: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="bg-secondary/40 rounded-lg p-3 grid grid-cols-3 gap-3 text-center">
              <div><div className="text-[10px] text-muted-foreground uppercase">Inscrição</div><div className="font-bold text-primary">+{xpPreview.s} XP</div></div>
              <div><div className="text-[10px] text-muted-foreground uppercase">Por vitória</div><div className="font-bold text-accent">+{xpPreview.w} XP</div></div>
              <div><div className="text-[10px] text-muted-foreground uppercase">Campeão</div><div className="font-bold text-warning">+{xpPreview.c} XP</div></div>
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <Label className="cursor-pointer">Torneio verificado</Label>
                <p className="text-[11px] text-muted-foreground">Exige telefone confirmado para inscrição</p>
              </div>
              <Switch checked={!!form.verified} onCheckedChange={v => setForm({ ...form, verified: v })} />
            </div>

            <div>
              <Label>Tipos de prêmio (sem dinheiro real)</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PRIZE_OPTIONS.map(opt => {
                  const checked = (form.prize_types || []).includes(opt.id);
                  return (
                    <button type="button" key={opt.id}
                      onClick={() => setForm({ ...form, prize_types: checked ? form.prize_types.filter((p: string) => p !== opt.id) : [...(form.prize_types || []), opt.id] })}
                      className={`text-left text-sm px-3 py-2 rounded-lg border ${checked ? 'border-primary bg-primary/10 text-primary glow-primary' : 'border-border bg-card text-muted-foreground'}`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {form.prize_types?.includes('xp_bonus') && (
              <div><Label>XP bônus adicional</Label><Input type="number" value={form.prize_xp_bonus} onChange={e => setForm({ ...form, prize_xp_bonus: e.target.value })} /></div>
            )}
            {form.prize_types?.includes('title') && (
              <div><Label>Nome do título de conquista</Label><Input value={form.prize_title} onChange={e => setForm({ ...form, prize_title: e.target.value })} placeholder="ex: Campeão — Inverno 2026" /></div>
            )}
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de participantes */}
      <Dialog open={!!bracketFor} onOpenChange={() => setBracketFor(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{bracketFor?.title} — Participantes</DialogTitle></DialogHeader>
          {participants.length === 0 ? <EstadoVazio titulo="Nenhum participante inscrito" /> : (
            <ul className="max-h-72 overflow-y-auto space-y-1 text-sm">
              {participants.map(p => (
                <li key={p.user_id} className="px-3 py-2 rounded bg-secondary/30 flex items-center gap-2">
                  <span className="flex-1 truncate">{p.display_name || p.user_id.slice(0, 8)}</span>
                  <Select value={String(p.final_rank ?? '')} onValueChange={v => setRank(p.user_id, v ? Number(v) : null)}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Posição" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">—</SelectItem>
                      <SelectItem value="1">🥇 1º</SelectItem>
                      <SelectItem value="2">🥈 2º</SelectItem>
                      <SelectItem value="3">🥉 3º</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => talkToParticipant(p.user_id)} title="Falar com participante">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => banUser(p.user_id)} title="Banir do torneio">
                    <Ban className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Ban className="h-3.5 w-3.5 text-destructive" /> Banidos ({bans.length})
              </p>
              <Input placeholder="Motivo do banimento (opcional)" value={banReason} onChange={e => setBanReason(e.target.value)} className="w-64 h-7 text-xs" />
            </div>
            {bans.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">Nenhum banimento ativo neste torneio.</p>
            ) : (
              <ul className="max-h-40 overflow-y-auto space-y-1 text-xs">
                {bans.map(b => (
                  <li key={b.id} className="px-2 py-1.5 rounded bg-destructive/10 border border-destructive/20 flex items-center gap-2">
                    <span className="flex-1 truncate">
                      <strong>{b.display_name || b.user_id.slice(0, 8)}</strong>
                      {b.reason && <span className="text-muted-foreground ml-2">— {b.reason}</span>}
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => unbanUser(b.id)}>Desbanir</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button onClick={generateBracket} disabled={participants.length < 2}><Shuffle className="h-4 w-4 mr-1" /> Gerar/Sortear chaves</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir torneio?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{confirmDelete?.title}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (confirmDelete) await remove(confirmDelete); setConfirmDelete(null); }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDistribute} onOpenChange={(o) => { if (!o) setConfirmDistribute(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Distribuir recompensas?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar a distribuição de XP, badges e títulos para os vencedores de <strong>{confirmDistribute?.title}</strong>? Esta ação é definitiva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { if (confirmDistribute) await distribute(confirmDistribute); setConfirmDistribute(null); }}
            >Distribuir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmRegen} onOpenChange={(o) => { if (!o) setConfirmRegen(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir chaves existentes?</AlertDialogTitle>
            <AlertDialogDescription>Já existem chaves geradas. Tem certeza que deseja substituí-las?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const fn = confirmRegen; setConfirmRegen(null); fn && fn(); }}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}