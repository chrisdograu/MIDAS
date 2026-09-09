// Rodada 32 — moderação de mídia social dos jogos (screenshots e opiniões).
// Acesso é auditado: as RPCs exigem justificativa (mín. 6 caracteres) e
// registram listagem, mudança de visibilidade e exclusão em `admin_logs`.
import { useState, useMemo } from 'react';
import { Loader2, ShieldAlert, Trash2, Image as ImageIcon, MessageSquare, Download, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EstadoVazio from '@/components/EstadoVazio';
import { formatDate } from '@/lib/format';
import { exportCsv } from '../lib/adminLog';

type Kind = 'screenshots' | 'opinions';

interface Row {
  id: string; user_id: string; product_id: string | null;
  texto: string | null; images: string[] | null; is_spoiler: boolean | null;
  visibility: string; likes_count: number | null; created_at: string;
}

const VIS_LABEL: Record<string, string> = {
  public: 'Público', friends: 'Amigos', close_friends: 'Amigos próximos', private: 'Só o autor',
};

const ITEMS_PER_PAGE = 20;

export default function GameMediaModeration({ kind }: { kind: Kind }) {
  const { toast } = useToast();
  const [motivo, setMotivo] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [names, setNames] = useState<{ users: Record<string, string>; games: Record<string, string> }>({ users: {}, games: {} });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleteMotivo, setDeleteMotivo] = useState('');
  const [busca, setBusca] = useState('');
  // GAP-D383: Filtros
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [spoilerFilter, setSpoilerFilter] = useState('all');
  // GAP-D382: Paginação
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [exporting, setExporting] = useState(false);

  const carregar = async () => {
    if (motivo.trim().length < 6) {
      toast({ title: 'Justificativa obrigatória', description: 'Explique em pelo menos 6 caracteres por que precisa ver este conteúdo.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_game_media', { _kind: kind, _reason: motivo.trim() });
    if (error) {
      setLoading(false);
      toast({ title: 'Não foi possível carregar', description: error.message, variant: 'destructive' });
      return;
    }
    const list = (data || []) as Row[];
    const userIds = [...new Set(list.map(r => r.user_id))];
    const prodIds = [...new Set(list.map(r => r.product_id).filter(Boolean))] as string[];
    const [{ data: profiles }, { data: prods }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id, display_name').in('id', userIds) : Promise.resolve({ data: [] as any[] }),
      prodIds.length ? supabase.from('produtos').select('id, title').in('id', prodIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    setNames({
      users: Object.fromEntries((profiles || []).map((p: any) => [p.id, p.display_name || 'Usuário'])),
      games: Object.fromEntries((prods || []).map((p: any) => [p.id, p.title])),
    });
    setRows(list);
    setPage(0);
    setHasMore(list.length > ITEMS_PER_PAGE);
    setLoading(false);
  };

  const mudarVisibilidade = async (row: Row, visibility: string) => {
    setBusy(row.id);
    const { error } = await supabase.rpc('admin_set_content_visibility', {
      _kind: kind, _id: row.id, _visibility: visibility, _reason: motivo.trim(),
    });
    setBusy(null);
    if (error) { toast({ title: 'Não foi possível moderar', description: error.message, variant: 'destructive' }); return; }
    setRows(prev => (prev || []).map(r => (r.id === row.id ? { ...r, visibility } : r)));
    toast({ title: `Visibilidade alterada para "${VIS_LABEL[visibility]}"` });
  };

  const excluir = async () => {
    if (!pendingDelete) return;
    if (deleteMotivo.trim().length < 6) {
      toast({ title: 'Justificativa obrigatória', description: 'Mínimo de 6 caracteres.', variant: 'destructive' });
      return;
    }
    setBusy(pendingDelete.id);
    const { error } = await supabase.rpc('admin_delete_game_media', {
      _kind: kind, _id: pendingDelete.id, _reason: deleteMotivo.trim(),
    });
    setBusy(null);
    if (error) { toast({ title: 'Não foi possível excluir', description: error.message, variant: 'destructive' }); return; }
    setRows(prev => (prev || []).filter(r => r.id !== pendingDelete.id));
    setPendingDelete(null);
    setDeleteMotivo('');
    toast({ title: 'Conteúdo removido' });
  };

  // GAP-D383: Filtros
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const visFilter = visibilityFilter !== 'all' ? visibilityFilter : null;
    const spoiler = spoilerFilter !== 'all' ? spoilerFilter === 'true' : null;
    
    return (rows || []).filter(r => {
      if (q) {
        const autor = (names.users[r.user_id] || '').toLowerCase();
        const jogo = (r.product_id ? names.games[r.product_id] || '' : '').toLowerCase();
        if (!autor.includes(q) && !jogo.includes(q) && !(r.texto || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      if (visFilter && r.visibility !== visFilter) return false;
      if (spoiler !== null && r.is_spoiler !== spoiler) return false;
      return true;
    });
  }, [rows, busca, visibilityFilter, spoilerFilter, names]);

  // GAP-D382: Paginação
  const totalPages = Math.ceil(filtradas.length / ITEMS_PER_PAGE);
  const paginated = filtradas.slice(0, (page + 1) * ITEMS_PER_PAGE);

  const handleLoadMore = () => {
    if (hasMore && (page + 1) * ITEMS_PER_PAGE < filtradas.length) {
      setPage(p => p + 1);
    }
  };

  // GAP-D385: Exportar
  const exportData = () => {
    setExporting(true);
    const data = filtradas.map(r => ({
      Autor: names.users[r.user_id] || 'Usuário',
      Jogo: (r.product_id && names.games[r.product_id]) || '—',
      Conteúdo: r.texto || '—',
      Imagens: r.images?.length || 0,
      Spoiler: r.is_spoiler ? 'Sim' : 'Não',
      Visibilidade: VIS_LABEL[r.visibility] || r.visibility,
      Curtidas: r.likes_count || 0,
      Data: formatDate(r.created_at),
    }));
    exportCsv(`moderacao_${kind}_${new Date().toISOString().slice(0, 10)}.csv`, data);
    setExporting(false);
    toast.success('Dados exportados com sucesso');
  };

  const Icone = kind === 'screenshots' ? ImageIcon : MessageSquare;
  const titulo = kind === 'screenshots' ? 'Screenshots dos jogadores' : 'Opiniões rápidas dos jogadores';

  return (
    <div className="space-y-4">
      <Card className="border-warning/40">
        <CardContent className="py-4 space-y-3">
          <p className="text-sm flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4 text-warning" /> {titulo} — conteúdo privado de usuários
          </p>
          <p className="text-xs text-muted-foreground">
            Todo acesso fica registrado no histórico administrativo com a justificativa abaixo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              className="flex-1 min-w-[260px]"
              placeholder="Motivo do acesso (ex.: denúncia #123 sobre spoiler)"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            />
            <Button onClick={carregar} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Icone className="h-4 w-4 mr-2" />}
              {rows ? 'Recarregar' : 'Carregar conteúdo'}
            </Button>
            <Button variant="outline" onClick={exportData} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Exportar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows === null ? (
        <EstadoVazio icone={Icone} titulo="Conteúdo não carregado" descricao="Informe a justificativa e clique em carregar." />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <Input 
              placeholder="Buscar por autor, jogo ou texto..." 
              value={busca} 
              onChange={e => setBusca(e.target.value)} 
              className="max-w-sm"
            />
            {/* GAP-D383: Filtros */}
            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Visibilidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(VIS_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={spoilerFilter} onValueChange={setSpoilerFilter}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue placeholder="Spoiler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Com spoiler</SelectItem>
                <SelectItem value="false">Sem spoiler</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs"
              onClick={() => { setBusca(''); setVisibilityFilter('all'); setSpoilerFilter('all'); }}
            >
              Limpar
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtradas.length} itens
            </span>
          </div>

          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Autor</TableHead>
                    <TableHead>Jogo</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead className="w-20 text-center">Imagens</TableHead>
                    <TableHead className="w-24 text-center">Spoiler</TableHead>
                    <TableHead className="w-44 text-center">Visibilidade</TableHead>
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead className="w-24 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="p-0">
                      <EstadoVazio titulo="Nada encontrado" descricao="Ajuste a busca ou filtros acima." />
                    </TableCell></TableRow>
                  ) : paginated.map(r => (
                    <TableRow key={r.id} className="border-border hover:bg-muted/30">
                      <TableCell className="text-sm font-medium">{names.users[r.user_id] || 'Usuário'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                        {(r.product_id && names.games[r.product_id]) || '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[280px] truncate">{r.texto || '—'}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">{r.images?.length ?? 0}</TableCell>
                      <TableCell className="text-center">
                        {r.is_spoiler
                          ? <Badge className="bg-warning/15 text-warning">Spoiler</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Select value={r.visibility} onValueChange={v => mudarVisibilidade(r, v)} disabled={busy === r.id}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(VIS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs text-destructive"
                          disabled={busy === r.id} 
                          onClick={() => { setPendingDelete(r); setDeleteMotivo(''); }}
                        >
                          {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* GAP-D382: Paginação */}
          {filtradas.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Mostrando {Math.min((page + 1) * ITEMS_PER_PAGE, filtradas.length)} de {filtradas.length}
              </span>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 0} 
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs flex items-center px-2">{page + 1} / {totalPages || 1}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={!hasMore || (page + 1) * ITEMS_PER_PAGE >= filtradas.length} 
                  onClick={handleLoadMore}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={o => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este conteúdo?</AlertDialogTitle>
            <AlertDialogDescription>
              A remoção é definitiva e fica registrada com a justificativa informada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input 
            placeholder="Justificativa (mín. 6 caracteres)" 
            value={deleteMotivo} 
            onChange={e => setDeleteMotivo(e.target.value)} 
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}