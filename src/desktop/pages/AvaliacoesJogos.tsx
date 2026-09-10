// Rodada 30 · item 1 — administração das avaliações de JOGOS.
// Antes só existia a tela de avaliações entre usuários (marketplace C2C);
// as notas em estrelas (`avaliacoes`) e as reviews completas
// (`reviews_completas`) não tinham nenhuma tela de moderação.
import { useState, useEffect, useMemo } from 'react';
import { Star, Trash2, Loader2, Search, Check, X, Eye, EyeOff, FileText, AlertCircle, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate } from '@/lib/format';
import { gameDisplayName } from '@/lib/gameName';
import { adminLog } from '../lib/adminLog';
import GameMediaModeration from '../components/GameMediaModeration';

interface Nota {
  id: string; user_id: string; user_name: string; game_name: string;
  rating: number; comment: string | null; is_approved: boolean; created_at: string;
  hidden_reason?: string | null; is_banned?: boolean;
}

interface ReviewCompleta {
  id: string; user_id: string; user_name: string; game_name: string;
  analise: string; recomendacao: string | null; horas_jogadas: number | null;
  status: string | null; visibility: string; created_at: string;
  is_denunciada?: boolean;
}

const PAGE_SIZE = 50;

export default function AvaliacoesJogos() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [completas, setCompletas] = useState<ReviewCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all'); // GAP-D02
  const [sortBy, setSortBy] = useState('recent'); // GAP-D03
  const [page, setPage] = useState(0); // GAP-D01
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'nota' | 'completa'; id: string; label: string } | null>(null);
  const [viewing, setViewing] = useState<ReviewCompleta | null>(null);
  const [bannedUsers, setBannedUsers] = useState<Set<string>>(new Set()); // GAP-D05
  const [denunciasMap, setDenunciasMap] = useState<Map<string, number>>(new Map()); // GAP-D06
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    
    // GAP-D05: Buscar usuários banidos
    const { data: banned } = await supabase
      .from('profiles')
      .select('id')
      .gt('banned_until', new Date().toISOString());
    const bannedSet = new Set(banned?.map(b => b.id) || []);
    setBannedUsers(bannedSet);

    const [{ data: rawNotas, error: e1 }, { data: rawCompletas, error: e2 }] = await Promise.all([
      supabase.from('avaliacoes').select('*').order('created_at', { ascending: false }),
      supabase.from('reviews_completas').select('*').order('created_at', { ascending: false }),
    ]);
    if (e1 || e2) {
      toast({ title: 'Erro ao carregar avaliações', description: (e1 || e2)?.message, variant: 'destructive' });
    }
    const notasArr = rawNotas || [];
    const compArr = rawCompletas || [];

    const userIds = [...new Set([...notasArr.map(n => n.user_id), ...compArr.map(c => c.user_id)])];
    const prodIds = [...new Set([
      ...notasArr.map(n => n.product_id).filter(Boolean),
      ...compArr.map(c => c.product_id).filter(Boolean),
    ])] as string[];

    const [{ data: profiles }, { data: prods }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id, display_name').in('id', userIds) : Promise.resolve({ data: [] as any[] }),
      prodIds.length ? supabase.from('produtos').select('id, title, catalog_game_id').in('id', prodIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const catIds = [...new Set((prods || []).map((p: any) => p.catalog_game_id).filter(Boolean))] as string[];
    const { data: catalog } = catIds.length
      ? await supabase.from('games_catalog').select('id, title').in('id', catIds)
      : { data: [] as any[] };

    const profileMap = new Map<string, string>((profiles || []).map((p: any) => [p.id, p.display_name || 'Usuário']));
    const catalogMap = new Map<string, string>((catalog || []).map((g: any) => [g.id, g.title]));
    const gameMap = new Map<string, string>((prods || []).map((p: any) => [
      p.id,
      gameDisplayName(p.catalog_game_id ? catalogMap.get(p.catalog_game_id) : null, p.title),
    ]));

    // GAP-D06: Buscar denúncias
    const reviewIds = compArr.map(c => c.id);
    const { data: denuncias } = reviewIds.length
      ? await supabase.from('denuncias').select('entity_id, status').eq('entity_type', 'review_completa').in('entity_id', reviewIds)
      : { data: [] as any[] };
    const denMap = new Map<string, number>();
    denuncias?.forEach(d => denMap.set(d.entity_id, (denMap.get(d.entity_id) || 0) + 1));
    setDenunciasMap(denMap);

    setNotas(notasArr.map(n => ({
      id: n.id, user_id: n.user_id, user_name: profileMap.get(n.user_id) || 'Usuário',
      game_name: (n.product_id && gameMap.get(n.product_id)) || 'Jogo',
      rating: Number(n.rating), comment: n.comment, is_approved: n.is_approved, created_at: n.created_at,
      hidden_reason: n.hidden_reason, is_banned: bannedSet.has(n.user_id),
    })));
    setCompletas(compArr.map(c => ({
      id: c.id, user_id: c.user_id, user_name: profileMap.get(c.user_id) || 'Usuário',
      game_name: gameMap.get(c.product_id) || 'Jogo',
      analise: c.analise, recomendacao: c.recomendacao, horas_jogadas: c.horas_jogadas,
      status: c.status, visibility: c.visibility, created_at: c.created_at,
      is_denunciada: (denMap.get(c.id) || 0) > 0,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const notasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notas.filter(n => {
      if (q && !n.user_name.toLowerCase().includes(q) && !n.game_name.toLowerCase().includes(q)) return false;
      if (ratingFilter !== 'all' && Math.floor(n.rating) !== Number(ratingFilter)) return false;
      if (statusFilter === 'aprovadas' && !n.is_approved) return false;
      if (statusFilter === 'ocultas' && n.is_approved) return false;
      if (statusFilter === 'banidas' && !n.is_banned) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'highest') return b.rating - a.rating;
      if (sortBy === 'lowest') return a.rating - b.rating;
      return 0;
    });
  }, [notas, search, ratingFilter, statusFilter, sortBy]);

  // GAP-D02: Filtro de visibilidade para Reviews Completas
  const completasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return completas.filter(c => {
      if (q && !c.user_name.toLowerCase().includes(q) && !c.game_name.toLowerCase().includes(q)) return false;
      if (visibilityFilter !== 'all' && c.visibility !== visibilityFilter) return false;
      return true;
    });
  }, [completas, search, visibilityFilter]);

  // GAP-D01: Paginação
  const paginatedNotas = useMemo(() => {
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return notasFiltradas.slice(start, end);
  }, [notasFiltradas, page]);

  const paginatedCompletas = useMemo(() => {
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return completasFiltradas.slice(start, end);
  }, [completasFiltradas, page]);

  const totalNotasPages = Math.ceil(notasFiltradas.length / PAGE_SIZE);
  const totalCompletasPages = Math.ceil(completasFiltradas.length / PAGE_SIZE);

  const toggleAprovacao = async (n: Nota) => {
    setBusy(n.id);
    const next = !n.is_approved;
    const { error } = await supabase.from('avaliacoes').update({ is_approved: next }).eq('id', n.id);
    setBusy(null);
    if (error) { toast({ title: 'Não foi possível salvar', description: error.message, variant: 'destructive' }); return; }
    await adminLog({
      action: next ? 'aprovar_avaliacao' : 'ocultar_avaliacao',
      entity: 'avaliacoes', entity_id: n.id,
      payload: { antes: { is_approved: n.is_approved }, depois: { is_approved: next }, jogo: n.game_name, usuario: n.user_name },
    });
    toast({ title: next ? 'Avaliação aprovada' : 'Avaliação ocultada do site' });
    fetchAll();
  };

  // GAP-D07: Advertir
  const advertirUsuario = async (userId: string, motivo: string) => {
    setBusy(userId);
    const { error } = await supabase.from('moderation_history').insert({
      user_id: userId,
      action: 'advertir',
      reason: motivo,
      moderator_id: (await supabase.auth.getUser()).data.user?.id,
    });
    setBusy(null);
    if (error) { toast({ title: 'Erro ao advertir', description: error.message, variant: 'destructive' }); return; }
    await adminLog({
      action: 'advertir_usuario',
      entity: 'moderation_history',
      entity_id: userId,
      reason: motivo,
    });
    toast({ title: 'Usuário advertido', description: 'Notificação enviada ao usuário' });
    fetchAll();
  };

  // GAP-D04: Exportar CSV
  const exportCSV = () => {
    const headers = ['Usuário', 'Jogo', 'Nota', 'Comentário', 'Status', 'Data'];
    const rows = notasFiltradas.map(n => [
      n.user_name,
      n.game_name,
      n.rating,
      n.comment || '',
      n.is_approved ? 'Publicada' : 'Oculta',
      formatDate(n.created_at),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avaliacoes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado com sucesso' });
  };

  const toggleVisibilidade = async (c: ReviewCompleta) => {
    setBusy(c.id);
    const next = c.visibility === 'private' ? 'friends' : 'private';
    const { error } = await supabase.from('reviews_completas').update({ visibility: next }).eq('id', c.id);
    setBusy(null);
    if (error) { toast({ title: 'Não foi possível salvar', description: error.message, variant: 'destructive' }); return; }
    await adminLog({
      action: next === 'private' ? 'ocultar_review_completa' : 'restaurar_review_completa',
      entity: 'reviews_completas', entity_id: c.id,
      payload: { antes: { visibility: c.visibility }, depois: { visibility: next }, jogo: c.game_name, usuario: c.user_name },
    });
    toast({ title: next === 'private' ? 'Review restrita ao autor' : 'Review liberada para amigos' });
    fetchAll();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const table = pendingDelete.kind === 'nota' ? 'avaliacoes' : 'reviews_completas';
    setBusy(pendingDelete.id);
    const { error } = await supabase.from(table as any).delete().eq('id', pendingDelete.id);
    setBusy(null);
    if (error) { toast({ title: 'Não foi possível excluir', description: error.message, variant: 'destructive' }); return; }
    await adminLog({
      action: pendingDelete.kind === 'nota' ? 'excluir_avaliacao' : 'excluir_review_completa',
      entity: table, entity_id: pendingDelete.id, reason: 'moderação administrativa',
      payload: { referencia: pendingDelete.label },
    });
    toast({ title: 'Registro excluído' });
    setPendingDelete(null);
    fetchAll();
  };

  const media = notas.length ? (notas.reduce((s, n) => s + n.rating, 0) / notas.length).toFixed(1) : '0';

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="h-6 w-6 text-primary" /> Avaliações de Jogos</h1>
          <p className="text-muted-foreground text-sm">Moderação das notas em estrelas e das reviews completas da loja</p>
        </div>
        {/* GAP-D04: Exportar CSV */}
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Notas recebidas', value: notas.length, color: 'text-primary' },
          { label: 'Média geral', value: media, color: 'text-warning' },
          { label: 'Ocultas', value: notas.filter(n => !n.is_approved).length, color: 'text-destructive' },
          { label: 'Reviews completas', value: completas.length, color: 'text-primary' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="py-4 px-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por usuário ou jogo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as notas</SelectItem>
            {[5, 4, 3, 2, 1].map(r => <SelectItem key={r} value={String(r)}>{r} estrela{r > 1 ? 's' : ''}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="aprovadas">Publicadas</SelectItem>
            <SelectItem value="ocultas">Ocultas</SelectItem>
            <SelectItem value="banidas">Usuário banido</SelectItem>
          </SelectContent>
        </Select>
        {/* GAP-D03: Ordenação */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigas</SelectItem>
            <SelectItem value="highest">Maior nota</SelectItem>
            <SelectItem value="lowest">Menor nota</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="notas">
        <TabsList>
          <TabsTrigger value="notas">Notas ({notasFiltradas.length})</TabsTrigger>
          <TabsTrigger value="completas">Reviews completas ({completasFiltradas.length})</TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
          <TabsTrigger value="opinioes">Opiniões</TabsTrigger>
        </TabsList>

        <TabsContent value="notas" className="mt-4">
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="border-border">
                  <TableHead>Usuário</TableHead><TableHead>Jogo</TableHead>
                  <TableHead className="text-center w-32">Nota</TableHead><TableHead>Comentário</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead><TableHead className="w-28">Data</TableHead>
                  <TableHead className="text-center w-48">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {paginatedNotas.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="p-0">
                      <EstadoVazio titulo="Nenhuma avaliação" descricao="Ajuste a busca ou os filtros acima." />
                    </TableCell></TableRow>
                  ) : paginatedNotas.map(n => (
                    <TableRow key={n.id} className="border-border hover:bg-muted/30">
                      <TableCell className="text-sm font-medium flex items-center gap-2">
                        {n.user_name}
                        {n.is_banned && <Badge className="bg-destructive/15 text-destructive text-[10px]">🚫 Banido</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">{n.game_name}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(n.rating) ? 'text-warning fill-gold' : 'text-muted-foreground/30'}`} />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">{n.rating.toFixed(1)}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-sm max-w-[260px] truncate">{n.comment || '—'}</TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge className={n.is_approved ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}>
                                {n.is_approved ? 'Publicada' : 'Oculta'}
                              </Badge>
                            </TooltipTrigger>
                            {n.hidden_reason && (
                              <TooltipContent>
                                <p className="text-xs max-w-xs">{n.hidden_reason}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(n.created_at)}</TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={busy === n.id} onClick={() => toggleAprovacao(n)}>
                          {n.is_approved ? <><X className="h-3 w-3 mr-1" />Ocultar</> : <><Check className="h-3 w-3 mr-1" />Aprovar</>}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" disabled={busy === n.id}
                          onClick={() => setPendingDelete({ kind: 'nota', id: n.id, label: `${n.user_name} · ${n.game_name}` })}>
                          <Trash2 className="h-3 w-3 mr-1" />Excluir
                        </Button>
                        {n.is_banned && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-warning" 
                            onClick={() => advertirUsuario(n.user_id, 'Comportamento inadequado em avaliações')}>
                            <AlertCircle className="h-3 w-3 mr-1" />Advertir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* GAP-D01: Paginação */}
              <div className="flex items-center justify-between p-4 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {notasFiltradas.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, notasFiltradas.length)} de ${notasFiltradas.length}` : '0 resultados'}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs flex items-center px-2">
                    {page + 1} / {totalNotasPages || 1}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalNotasPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completas" className="mt-4">
          <div className="flex gap-3 mb-4">
            {/* GAP-D02: Filtro de visibilidade */}
            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as visibilidades</SelectItem>
                <SelectItem value="private">Só o autor</SelectItem>
                <SelectItem value="friends">Amigos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="border-border">
                  <TableHead>Autor</TableHead><TableHead>Jogo</TableHead>
                  <TableHead>Veredito</TableHead><TableHead className="w-24 text-center">Horas</TableHead>
                  <TableHead className="w-32 text-center">Visibilidade</TableHead>
                  <TableHead className="w-28">Data</TableHead>
                  <TableHead className="text-center w-56">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {paginatedCompletas.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="p-0">
                      <EstadoVazio titulo="Nenhuma review completa" descricao="As reviews escritas pelos jogadores aparecem aqui." />
                    </TableCell></TableRow>
                  ) : paginatedCompletas.map(c => (
                    <TableRow key={c.id} className="border-border hover:bg-muted/30">
                      <TableCell className="text-sm font-medium flex items-center gap-2">
                        {c.user_name}
                        {c.is_denunciada && <Badge className="bg-warning/15 text-warning text-[10px]">⚠️ Denunciada</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{c.game_name}</TableCell>
                      <TableCell className="text-sm max-w-[220px] truncate">{c.recomendacao || c.analise}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">{c.horas_jogadas ?? '—'}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={c.visibility === 'private' ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'}>
                          {c.visibility === 'private' ? 'Só o autor' : 'Amigos'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setViewing(c)}>
                          <FileText className="h-3 w-3 mr-1" />Ver
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={busy === c.id} onClick={() => toggleVisibilidade(c)}>
                          {c.visibility === 'private' ? <><Eye className="h-3 w-3 mr-1" />Liberar</> : <><EyeOff className="h-3 w-3 mr-1" />Ocultar</>}
                        </Button>
                        {c.is_denunciada && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-warning">
                            <AlertCircle className="h-3 w-3 mr-1" />Ver denúncia
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" disabled={busy === c.id}
                          onClick={() => setPendingDelete({ kind: 'completa', id: c.id, label: `${c.user_name} · ${c.game_name}` })}>
                          <Trash2 className="h-3 w-3 mr-1" />Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* GAP-D01: Paginação */}
              <div className="flex items-center justify-between p-4 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {completasFiltradas.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, completasFiltradas.length)} de ${completasFiltradas.length}` : '0 resultados'}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs flex items-center px-2">
                    {page + 1} / {totalCompletasPages || 1}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalCompletasPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="screenshots" className="mt-4">
          <GameMediaModeration kind="screenshots" showSearch showPagination showActions />
        </TabsContent>

        <TabsContent value="opinioes" className="mt-4">
          <GameMediaModeration kind="opinions" showSearch showPagination showActions />
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Review de {viewing?.user_name}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-muted-foreground">{viewing.game_name} · {formatDate(viewing.created_at)}</p>
              {viewing.recomendacao && <p><b>Veredito:</b> {viewing.recomendacao}</p>}
              <p className="whitespace-pre-wrap">{viewing.analise}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={o => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === 'nota' ? 'A nota' : 'A review'} de <b>{pendingDelete?.label}</b> será removida do banco.
              A ação não pode ser desfeita e ficará registrada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}